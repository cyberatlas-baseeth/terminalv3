import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
    if (!supabaseClient) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Supabase environment variables are not configured');
        }

        supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    }
    return supabaseClient;
}

// Token tablosu oluşturma SQL'i (Supabase SQL Editor'da çalıştırılmalı):
/*
CREATE TABLE IF NOT EXISTS player_tokens (
    fid BIGINT PRIMARY KEY,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_player_tokens_updated_at BEFORE UPDATE
ON player_tokens FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
*/

// Get player's total tokens
export async function getPlayerTokens(fid: number): Promise<number> {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('player_tokens')
            .select('total_tokens')
            .eq('fid', fid)
            .single();

        if (error || !data) {
            return 0;
        }

        return data.total_tokens;
    } catch (error) {
        console.error('Error getting player tokens:', error);
        return 0;
    }
}

// Add tokens to player
export async function addPlayerTokens(fid: number, amount: number): Promise<number> {
    try {
        const supabase = getSupabaseClient();

        // First try to get existing record
        const { data: existing } = await supabase
            .from('player_tokens')
            .select('total_tokens')
            .eq('fid', fid)
            .single();

        if (existing) {
            // Update existing record
            const newTotal = existing.total_tokens + amount;
            await supabase
                .from('player_tokens')
                .update({ total_tokens: newTotal })
                .eq('fid', fid);
            return newTotal;
        } else {
            // Insert new record
            await supabase
                .from('player_tokens')
                .insert({ fid, total_tokens: amount });
            return amount;
        }
    } catch (error) {
        console.error('Error adding player tokens:', error);
        return 0;
    }
}

// Get leaderboard (top 10 players)
export async function getLeaderboard(): Promise<{ fid: number; total_tokens: number }[]> {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('player_tokens')
            .select('fid, total_tokens')
            .order('total_tokens', { ascending: false })
            .limit(10);

        if (error || !data) {
            return [];
        }

        return data;
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        return [];
    }
}
