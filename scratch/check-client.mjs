import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
const envVars = {};
for (const line of lines) {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"|"$/g, '');
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseServiceKey) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get webgeckofl client
  const { data: client } = await supabase.from('clients').select('*').eq('slug', 'webgeckofl').single();
  console.log('Client info:', client);
  
  if (client) {
    // Get job
    const { data: job } = await supabase.from('jobs').select('*').eq('id', client.job_id).single();
    console.log('Job info:', job);
    
    // Get payment state
    const { data: payment } = await supabase.from('payment_state').select('*').eq('job_id', client.job_id).single();
    console.log('Payment state:', payment);
    
    // Get bookings count
    const { count: bookingsCount } = await supabase.from('bookings').select('id', { count: 'exact' }).eq('client_slug', 'webgeckofl');
    console.log('Bookings count:', bookingsCount);

    // Get analytics
    const { data: analytics } = await supabase.from('analytics').select('*').eq('job_id', client.job_id).limit(10);
    console.log('Analytics sample:', analytics);
  }
}
