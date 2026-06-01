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
  const { data: client } = await supabase.from('clients').select('*').eq('slug', 'webgeckofl').single();
  if (client) {
    console.log('Client Fields:', Object.keys(client));
    console.log('Client details (non-sensitive):');
    const { password, ...safe } = client;
    console.log(JSON.stringify(safe, null, 2));
  } else {
    console.log('Client webgeckofl not found');
  }
}
