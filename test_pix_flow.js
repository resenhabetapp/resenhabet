import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ljbsbnranipheqenqoib.supabase.co';
const supabaseKey = 'sb_publishable_mwLa0OVjOZ0cbroaSvdvcQ_bWN3nrD8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runPixTest() {
  console.log('--- STARTING PIX FLOW INTEGRATION TEST ---');

  try {
    // 1. Sign in with the test user
    const email = 'resenhabet_test_137810@gmail.com';
    const password = 'testPassword123!';
    console.log(`Signing in test user: ${email}...`);
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authErr) throw authErr;
    const testUser = authData.user;
    if (!testUser) throw new Error('Failed to sign in.');
    console.log(`Test user signed in with ID: ${testUser.id}`);

    // Get current token balance before purchase
    const { data: profileBefore, error: profileErr } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', testUser.id)
      .single();
    if (profileErr) throw profileErr;
    console.log(`Current token balance: ${profileBefore.tokens ?? 0} tokens`);

    // 2. Call the create-pix Edge Function
    console.log('\nInvoking create-pix Edge Function for package pkg_10 (10 Tokens - R$ 10,00)...');
    const { data, error: funcErr } = await supabase.functions.invoke('create-pix', {
      body: { packageId: 'pkg_10' }
    });

    if (funcErr) {
      console.log('\n❌ create-pix Edge Function call failed.');
      console.log('Error details:', funcErr.message);
      console.log('\n💡 Tip: Make sure you have deployed the Edge Function using:');
      console.log('   npx supabase functions deploy create-pix --project-ref ljbsbnranipheqenqoib');
      console.log('   And that you set ASAAS_API_KEY in the Supabase dashboard secrets.');
      return;
    }

    if (!data || !data.success) {
      console.log('\n❌ create-pix returned success: false.');
      console.log('Response:', data);
      return;
    }

    console.log('\n✅ create-pix executed successfully!');
    console.log(`Payment ID (Asaas): ${data.paymentId}`);
    console.log(`Pix Copia e Cola Payload: ${data.payload.substring(0, 50)}...`);
    console.log(`QR Code image base64 length: ${data.encodedImage.length} characters`);
    console.log(`Expiration Date: ${data.expirationDate}`);

    // 3. Verify the transaction was inserted in the database
    console.log('\nVerifying database entry for token_transactions...');
    const { data: tx, error: txErr } = await supabase
      .from('token_transactions')
      .select('*')
      .eq('external_id', data.paymentId)
      .maybeSingle();

    if (txErr || !tx) {
      console.log('❌ Transaction not found in database or query failed:', txErr?.message);
    } else {
      console.log('✅ Transaction found in database:');
      console.log(`   ID: ${tx.id}`);
      console.log(`   User ID: ${tx.user_id}`);
      console.log(`   Amount: ${tx.amount} tokens`);
      console.log(`   Price: R$ ${tx.price}`);
      console.log(`   Status: ${tx.status} (expected: pending)`);
    }

    console.log('\n--- MOCKING WEBHOOK PAYMENT RECEIVED ---');
    console.log('To simulate a webhook payment confirm, run:');
    console.log(`curl -X POST https://ljbsbnranipheqenqoib.supabase.co/functions/v1/asaas-webhook \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -H "asaas-access-token: YOUR_WEBHOOK_SECRET" \\`);
    console.log(`  -d '{"event": "PAYMENT_RECEIVED", "payment": {"externalReference": "${tx?.id || 'TRANSACTION_ID'}"}}'`);

    console.log('\n--- PIX FLOW INTEGRATION TEST COMPLETE ---');

  } catch (err) {
    console.error('Test run failed with error:', err);
  }
}

runPixTest();
