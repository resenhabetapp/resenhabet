import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ljbsbnranipheqenqoib.supabase.co';
const supabaseKey = 'sb_publishable_mwLa0OVjOZ0cbroaSvdvcQ_bWN3nrD8';
const supabase = createClient(supabaseUrl, supabaseKey);

const TENNIS_ROOM_ID = '8aadf233-dadb-41d6-aa98-d78d02fbde30';

async function run() {
  console.log('--- TESTING ANONYMOUS GUESS UPDATE & SETTLE ---');
  
  // 1. Submit a test guess
  const { data, error } = await supabase.rpc('submit_guess', {
    p_room_id: TENNIS_ROOM_ID,
    p_bettor_name: 'Test Settlement Bettor',
    p_bettor_pix_key: 'test@pix.com',
    p_home_score: null,
    p_away_score: null,
    p_guess_data: { winner: 'player_a', sets_score: '2x1' }
  });

  if (error) {
    console.error('❌ Guess submission failed:', error);
    return;
  }
  
  const guess = Array.isArray(data) ? data[0] : data;
  console.log('✅ Guess submitted. ID:', guess.id);

  // 2. Try to update payment status to confirmed
  const { data: updateData, error: updateErr, status } = await supabase
    .from('guesses')
    .update({ payment_status: 'confirmed' })
    .eq('id', guess.id)
    .select();

  if (updateErr) {
    console.log('❌ RLS blocked guess payment update:', updateErr);
  } else {
    console.log('✅ Payment status updated successfully! Rows returned:', updateData);
    
    // 3. If update succeeded, we can test settle_room!
    console.log('Calling settle_room...');
    const { data: winners, error: settleErr } = await supabase.rpc('settle_room', {
      p_room_id: TENNIS_ROOM_ID,
      p_home_score: 2,
      p_away_score: 1,
      p_result_data: { sets_score: '2x1' }
    });

    if (settleErr) {
      console.error('❌ settle_room failed:', settleErr);
    } else {
      console.log('✅ settle_room completed successfully! Winners list:', winners);
    }
  }

  // 4. Clean up: delete test guess
  await supabase.from('guesses').delete().eq('id', guess.id);
  console.log('🧹 Test data cleaned up.');
}

run().catch(console.error);
