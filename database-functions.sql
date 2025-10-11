-- SQL functions for Supabase database

-- SETUP INSTRUCTIONS:
-- 1. Run this first in Supabase SQL editor to add the column:
--    ALTER TABLE users ADD COLUMN IF NOT EXISTS user_discriminator TEXT;
--    CREATE INDEX IF NOT EXISTS idx_users_username_discriminator ON users(username, user_discriminator);
--
-- 2. Then run all the functions below
--
-- 3. Finally, migrate existing users by running:
--    SELECT migrate_existing_users();

-- Function to generate a unique discriminator for a username
CREATE OR REPLACE FUNCTION generate_discriminator(target_username TEXT)
RETURNS TEXT AS $$
DECLARE
  discriminator TEXT;
  counter INTEGER := 1;
  max_attempts INTEGER := 9999;
BEGIN
  LOOP
    -- Generate 4-digit discriminator
    discriminator := LPAD(counter::TEXT, 4, '0');
    
    -- Check if this username#discriminator combination exists
    IF NOT EXISTS (
      SELECT 1 FROM users 
      WHERE username = target_username AND user_discriminator = discriminator
    ) THEN
      RETURN discriminator;
    END IF;
    
    counter := counter + 1;
    
    -- Prevent infinite loop
    IF counter > max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique discriminator for username: %', target_username;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to migrate existing users without discriminators
CREATE OR REPLACE FUNCTION migrate_existing_users()
RETURNS INTEGER AS $$
DECLARE
  user_record RECORD;
  new_discriminator TEXT;
  updated_count INTEGER := 0;
BEGIN
  -- Find all users without discriminators
  FOR user_record IN 
    SELECT id, username FROM users WHERE user_discriminator IS NULL OR user_discriminator = ''
  LOOP
    -- Generate discriminator for this user
    new_discriminator := generate_discriminator(user_record.username);
    
    -- Update the user
    UPDATE users 
    SET user_discriminator = new_discriminator 
    WHERE id = user_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user by special ID (username#discriminator)
CREATE OR REPLACE FUNCTION get_user_by_special_id(special_id TEXT)
RETURNS TABLE (
  id UUID,
  username TEXT,
  user_discriminator TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  target_username TEXT;
  target_discriminator TEXT;
  hash_pos INTEGER;
BEGIN
  -- Find the position of '#' in the special_id
  hash_pos := POSITION('#' IN special_id);
  
  -- If no '#' found or invalid format, return empty
  IF hash_pos = 0 OR hash_pos = 1 OR hash_pos = LENGTH(special_id) THEN
    RETURN;
  END IF;
  
  -- Extract username and discriminator
  target_username := SUBSTRING(special_id FROM 1 FOR hash_pos - 1);
  target_discriminator := SUBSTRING(special_id FROM hash_pos + 1);
  
  -- Validate discriminator format (should be 4 digits)
  IF LENGTH(target_discriminator) != 4 OR target_discriminator !~ '^[0-9]+$' THEN
    RETURN;
  END IF;
  
  -- Return the user if found
  RETURN QUERY
  SELECT u.id, u.username, u.user_discriminator, u.display_name, u.avatar_url, u.is_online, u.last_seen
  FROM users u
  WHERE u.username = target_username AND u.user_discriminator = target_discriminator;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users that are not friends with the current user
CREATE OR REPLACE FUNCTION get_non_friends(current_user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_online BOOLEAN,
  last_seen TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_online, u.last_seen
  FROM users u
  WHERE u.id != current_user_id
    AND u.id NOT IN (
      -- Exclude existing friends
      SELECT CASE 
        WHEN f.user1_id = current_user_id THEN f.user2_id
        ELSE f.user1_id
      END
      FROM friendships f
      WHERE f.user1_id = current_user_id OR f.user2_id = current_user_id
    )
    AND u.id NOT IN (
      -- Exclude pending friend requests
      SELECT fr.from_user_id FROM friend_requests fr 
      WHERE fr.to_user_id = current_user_id AND fr.status = 'pending'
      UNION
      SELECT fr.to_user_id FROM friend_requests fr 
      WHERE fr.from_user_id = current_user_id AND fr.status = 'pending'
    )
  ORDER BY u.is_online DESC, u.last_seen DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create friendship (should already exist)
CREATE OR REPLACE FUNCTION create_friendship(user1 UUID, user2 UUID)
RETURNS UUID AS $$
DECLARE
  friendship_id UUID;
BEGIN
  INSERT INTO friendships (user1_id, user2_id, created_at)
  VALUES (user1, user2, NOW())
  RETURNING id INTO friendship_id;
  
  RETURN friendship_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user online status function
CREATE OR REPLACE FUNCTION update_user_online_status(user_id UUID, online_status BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET 
    is_online = online_status,
    last_seen = NOW()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;