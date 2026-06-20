import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

serve(async (req) => {
  try {
    // 1. Validar Token de Acesso do Webhook (Segurança)
    const asaasWebhookSecret = Deno.env.get("ASAAS_WEBHOOK_SECRET");
    const webhookToken = req.headers.get("asaas-access-token");

    if (asaasWebhookSecret && webhookToken !== asaasWebhookSecret) {
      return new Response(JSON.stringify({ error: "Token de webhook inválido ou não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { event, payment } = await req.json();

    // Nós só processamos a confirmação de recebimento do Pix
    if (event !== "PAYMENT_RECEIVED" && event !== "PAYMENT_CONFIRMED") {
      return new Response(JSON.stringify({ success: true, message: `Evento ${event} ignorado` }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const txId = payment.externalReference;
    if (!txId) {
      return new Response(JSON.stringify({ error: "ID de transação externa ausente (externalReference)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Buscar a transação em nosso banco
    const { data: tx, error: fetchError } = await supabaseAdmin
      .from("token_transactions")
      .select("user_id, amount, status")
      .eq("id", txId)
      .single();

    if (fetchError || !tx) {
      return new Response(JSON.stringify({ error: "Transação não encontrada no banco" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Se já estiver concluída, retornar sucesso para evitar créditos duplicados
    if (tx.status === "completed") {
      return new Response(JSON.stringify({ success: true, message: "Transação já processada anteriormente" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Atualizar a transação para concluída (completed)
    const { error: updateTxError } = await supabaseAdmin
      .from("token_transactions")
      .update({ status: "completed" })
      .eq("id", txId);

    if (updateTxError) {
      return new Response(JSON.stringify({ error: `Erro ao atualizar status da transação: ${updateTxError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Obter saldo atual de tokens do usuário
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from("profiles")
      .select("tokens")
      .eq("id", tx.user_id)
      .single();

    if (profileFetchError || !profile) {
      return new Response(JSON.stringify({ error: `Perfil do usuário não encontrado: ${profileFetchError?.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 5. Creditar os tokens comprados ao perfil do usuário
    const currentTokens = profile.tokens ?? 0;
    const newTokensCount = currentTokens + tx.amount;

    const { error: updateProfileError } = await supabaseAdmin
      .from("profiles")
      .update({ tokens: newTokensCount })
      .eq("id", tx.user_id);

    if (updateProfileError) {
      return new Response(JSON.stringify({ error: `Erro ao creditar saldo de tokens: ${updateProfileError.message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, message: `Crédito de ${tx.amount} tokens efetuado com sucesso!` }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno ao processar webhook" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
