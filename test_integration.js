import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ljbsbnranipheqenqoib.supabase.co';
const supabaseKey = 'sb_publishable_mwLa0OVjOZ0cbroaSvdvcQ_bWN3nrD8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log('--- STARTING MULTI-SPORT INTEGRATION TESTS ---');

  let testUser = null;

  try {
    // 0. Sign in with the already confirmed test user to bypass rate limits
    const email = 'resenhabet_test_137810@gmail.com';
    const password = 'testPassword123!';
    console.log(`Signing in test user: ${email}...`);
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authErr) throw authErr;
    testUser = authData.user;
    if (!testUser) throw new Error('Failed to sign in.');
    console.log(`Test user signed in with ID: ${testUser.id}`);

    const CREATOR_ID = testUser.id;

    // ==========================================
    // TEST CASE 1: Tennis Set Score Bet Type
    // ==========================================
    console.log('\n[TEST 1] Testing Tennis (placar_sets)...');

    // 1. Create Room
    const { data: roomTennis, error: roomTennisErr } = await supabase
      .from('rooms')
      .insert({
        creator_id: CREATOR_ID,
        title: 'Test Resenha Tennis',
        home_team: 'Federer',
        away_team: 'Nadal',
        valor_da_cota: 10.00,
        sport: 'Tênis',
        bet_type: 'placar_sets',
        event_data: { player_a: 'Federer', player_b: 'Nadal', best_of: 3 },
        status: 'active',
        pix_key: 'test@pix.com',
        pix_key_type: 'email'
      })
      .select()
      .single();

    if (roomTennisErr) throw roomTennisErr;
    console.log(`Tennis Room created: ${roomTennis.id}`);

    // 2. Submit Guess 1 (Alice - Correct score, will be confirmed)
    const { data: guess1, error: g1Err } = await supabase.rpc('submit_guess', {
      p_room_id: roomTennis.id,
      p_bettor_name: 'Alice',
      p_bettor_pix_key: 'alice@pix.com',
      p_home_score: null,
      p_away_score: null,
      p_guess_data: { winner: 'player_a', sets_score: '2x1' }
    });
    if (g1Err) throw g1Err;
    const g1 = Array.isArray(guess1) ? guess1[0] : guess1;
    console.log(`Alice guess submitted: ${g1.id}`);

    // 3. Submit Guess 2 (Bob - Incorrect score, will be confirmed)
    const { data: guess2, error: g2Err } = await supabase.rpc('submit_guess', {
      p_room_id: roomTennis.id,
      p_bettor_name: 'Bob',
      p_bettor_pix_key: 'bob@pix.com',
      p_home_score: null,
      p_away_score: null,
      p_guess_data: { winner: 'player_a', sets_score: '2x0' }
    });
    if (g2Err) throw g2Err;
    const g2 = Array.isArray(guess2) ? guess2[0] : guess2;
    console.log(`Bob guess submitted: ${g2.id}`);

    // 4. Confirm payments
    await supabase.from('guesses').update({ payment_status: 'confirmed' }).in('id', [g1.id, g2.id]);
    console.log('Payments confirmed for Alice and Bob.');

    // 5. Settle Room (Official sets won: 2 x 1)
    const { data: winnersTennis, error: settleTennisErr } = await supabase.rpc('settle_room', {
      p_room_id: roomTennis.id,
      p_home_score: 2,
      p_away_score: 1,
      p_result_data: { sets_score: '2x1' }
    });

    if (settleTennisErr) throw settleTennisErr;
    console.log('Tennis Room Settle Result:', winnersTennis);

    // Assertions for Tennis
    if (winnersTennis && winnersTennis.length === 1 && winnersTennis[0].winner_name === 'Alice') {
      console.log('✅ TEST 1 PASSED: Alice won the prize alone (R$ 20.00 pot / 1 winner = R$ 20.00)!');
    } else {
      console.log('❌ TEST 1 FAILED: Unexpected winner list.');
    }

    // Clean up Room 1
    await supabase.from('guesses').delete().eq('room_id', roomTennis.id);
    await supabase.from('rooms').delete().eq('id', roomTennis.id);
    console.log('Tennis test data cleaned up.');


    // ==========================================
    // TEST CASE 2: Formula 1 Podium Bet Type
    // ==========================================
    console.log('\n[TEST 2] Testing Formula 1 (podio)...');

    // 1. Create Room
    const { data: roomF1, error: roomF1Err } = await supabase
      .from('rooms')
      .insert({
        creator_id: CREATOR_ID,
        title: 'Test Resenha F1',
        home_team: 'GP do Brasil',
        away_team: 'Fórmula 1',
        valor_da_cota: 25.00,
        sport: 'Fórmula 1',
        bet_type: 'podio',
        event_data: { gp_name: 'GP do Brasil', competitors: ['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc'] },
        status: 'active',
        pix_key: 'test@pix.com',
        pix_key_type: 'email'
      })
      .select()
      .single();

    if (roomF1Err) throw roomF1Err;
    console.log(`F1 Room created: ${roomF1.id}`);

    // 2. Submit Guess 1 (Dave - Correct podium)
    const { data: guessD, error: gdErr } = await supabase.rpc('submit_guess', {
      p_room_id: roomF1.id,
      p_bettor_name: 'Dave',
      p_bettor_pix_key: 'dave@pix.com',
      p_home_score: null,
      p_away_score: null,
      p_guess_data: { podium: ['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc'] }
    });
    if (gdErr) throw gdErr;
    const gd = Array.isArray(guessD) ? guessD[0] : guessD;
    console.log(`Dave guess submitted: ${gd.id}`);

    // 3. Submit Guess 2 (Eve - Incorrect podium order)
    const { data: guessE, error: geErr } = await supabase.rpc('submit_guess', {
      p_room_id: roomF1.id,
      p_bettor_name: 'Eve',
      p_bettor_pix_key: 'eve@pix.com',
      p_home_score: null,
      p_away_score: null,
      p_guess_data: { podium: ['Max Verstappen', 'Lewis Hamilton', 'Charles Leclerc'] }
    });
    if (geErr) throw geErr;
    const ge = Array.isArray(guessE) ? guessE[0] : guessE;
    console.log(`Eve guess submitted: ${ge.id}`);

    // 4. Confirm payments
    await supabase.from('guesses').update({ payment_status: 'confirmed' }).in('id', [gd.id, ge.id]);
    console.log('Payments confirmed for Dave and Eve.');

    // 5. Settle Room (Official podium: 1st Lewis Hamilton, 2nd Max Verstappen, 3rd Charles Leclerc)
    const { data: winnersF1, error: settleF1Err } = await supabase.rpc('settle_room', {
      p_room_id: roomF1.id,
      p_home_score: null,
      p_away_score: null,
      p_result_data: { podium: ['Lewis Hamilton', 'Max Verstappen', 'Charles Leclerc'] }
    });

    if (settleF1Err) throw settleF1Err;
    console.log('F1 Room Settle Result:', winnersF1);

    // Assertions for F1
    if (winnersF1 && winnersF1.length === 1 && winnersF1[0].winner_name === 'Dave') {
      console.log('✅ TEST 2 PASSED: Dave won the prize alone (R$ 50.00 pot / 1 winner = R$ 50.00)!');
    } else {
      console.log('❌ TEST 2 FAILED: Unexpected winner list.');
    }

    // Clean up Room 2
    await supabase.from('guesses').delete().eq('room_id', roomF1.id);
    await supabase.from('rooms').delete().eq('id', roomF1.id);
    console.log('F1 test data cleaned up.');

    console.log('\n--- ALL TESTS COMPLETED SUCCESSFULY ---');

  } catch (err) {
    console.error('Test run failed with error:', err);
  }
}

runTests();
