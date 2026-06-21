import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKAGES: Record<string, { tokens: number; price: number }> = {
  pkg_10: { tokens: 10, price: 19.90 },
  pkg_25: { tokens: 25, price: 47.90 },
  pkg_50: { tokens: 50, price: 87.90 },
};

async function getOrCreateAsaasCustomer(apiKey: string, apiUrl: string): Promise<string> {
  const defaultCpfCnpj = "52927896909"; // CPF de teste válido
  const defaultName = "Cliente Faturamento ResenhaBet";
  const defaultEmail = "faturamento@resenhabet.com";

  // 1. Buscar cliente por CPF
  const searchUrl = `${apiUrl}/customers?cpfCnpj=${defaultCpfCnpj}`;
  const searchRes = await fetch(searchUrl, {
    method: "GET",
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json"
    }
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      return searchData.data[0].id;
    }
  }

  // 2. Se não encontrar, cadastrar novo cliente corporativo padrão
  const createUrl = `${apiUrl}/customers`;
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: defaultName,
      cpfCnpj: defaultCpfCnpj,
      email: defaultEmail,
      externalReference: "resenhabet_default_customer"
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Erro ao criar cliente padrão no Asaas: ${errText}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Autorização pendente (Token ausente)" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Inicializar Supabase Client para validar o usuário logado
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { packageId } = await req.json();
    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return new Response(JSON.stringify({ error: "Pacote de tokens inválido ou não informado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY") ?? "";
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: "Configuração do Asaas (API Key) ausente no servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Obter ou criar cliente no Asaas
    let asaasCustomerId = Deno.env.get("ASAAS_CUSTOMER_ID");
    if (!asaasCustomerId) {
      asaasCustomerId = await getOrCreateAsaasCustomer(asaasApiKey, asaasApiUrl);
    }

    // Inicializar Supabase Admin para inserir e atualizar transação com bypass de RLS
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Inserir transação pendente em nosso banco
    const { data: tx, error: txError } = await supabaseAdmin
      .from("token_transactions")
      .insert({
        user_id: user.id,
        amount: pkg.tokens,
        price: pkg.price,
        type: "purchase",
        status: "pending"
      })
      .select()
      .single();

    if (txError || !tx) {
      return new Response(JSON.stringify({ error: `Erro ao criar transação: ${txError?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Criar cobrança Pix no Asaas
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1); // Expiração em 1 dia
    const formattedDueDate = dueDate.toISOString().split("T")[0];

    const paymentRes = await fetch(`${asaasApiUrl}/payments`, {
      method: "POST",
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: "PIX",
        value: pkg.price,
        dueDate: formattedDueDate,
        externalReference: tx.id,
        description: `Adquirir ${pkg.tokens} Tokens no ResenhaBet`
      })
    });

    if (!paymentRes.ok) {
      const errText = await paymentRes.text();
      // Marcar transação local como falha
      await supabaseAdmin
        .from("token_transactions")
        .update({ status: "failed" })
        .eq("id", tx.id);

      return new Response(JSON.stringify({ error: `Erro no Asaas ao criar pagamento: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const paymentData = await paymentRes.json();
    const paymentId = paymentData.id;

    // 3. Atualizar a transação no banco com o external_id da cobrança do Asaas
    await supabaseAdmin
      .from("token_transactions")
      .update({ external_id: paymentId })
      .eq("id", tx.id);

    // 4. Obter o QR Code Pix e Payload "Copia e Cola" do Asaas
    // Importante: A API exige corpo vazio (sem chaves nem whitespace) no GET para evitar 403.
    const qrCodeRes = await fetch(`${asaasApiUrl}/payments/${paymentId}/pixQrCode`, {
      method: "GET",
      headers: {
        "access_token": asaasApiKey,
        "Content-Type": "application/json"
      }
    });

    if (!qrCodeRes.ok) {
      const errText = await qrCodeRes.text();
      return new Response(JSON.stringify({ error: `Erro ao obter QR Code no Asaas: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const qrCodeData = await qrCodeRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        paymentId,
        encodedImage: qrCodeData.encodedImage, // imagem QR Code em Base64
        payload: qrCodeData.payload,           // Copia e Cola
        expirationDate: qrCodeData.expirationDate
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro inesperado no processamento do Pix" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
