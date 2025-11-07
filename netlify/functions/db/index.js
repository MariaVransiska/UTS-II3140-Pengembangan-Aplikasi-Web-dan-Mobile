// Supabase connection helper used by serverless functions
const { createClient } = require('@supabase/supabase-js');

let supabaseClient = null;

function getEnv(name) {
  return process.env[name] || '';
}

const connectToDatabase = async () => {
  if (!supabaseClient) {
    const url = getEnv('SUPABASE_URL');
    const key = getEnv('SUPABASE_SERVICE_KEY') || getEnv('SUPABASE_ANON_KEY');

    if (!url || !key) {
      throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_KEY/ANON_KEY');
    }

    supabaseClient = createClient(url, key, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
};

// For future extension if multiple DBs are supported
const getDbType = () => 'supabase';

module.exports = { connectToDatabase, getDbType };


