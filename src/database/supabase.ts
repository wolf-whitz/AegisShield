import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const originalStringify = JSON.stringify;
JSON.stringify = function(value: any, replacer?: any, space?: any) {
  return originalStringify(value, (key, val) => {
    if (typeof val === 'bigint') return val.toString();
    if (replacer) return replacer(key, val);
    return val;
  }, space);
};

export const supabase = createClient(supabaseUrl, supabaseKey);