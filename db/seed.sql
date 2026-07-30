-- ============================================================
-- Campus Relay - seed data
--   psql -U postgres -d campus_relay -f db/seed.sql
--
-- Login accounts created by this file (password is the same style
-- for each role so they are easy to remember while developing):
--   Admin    9000000001 / Admin@123
--   Partner  9100000001 / Partner@123   (Ravi Kumar)
--   Partner  9100000002 / Partner@123   (Sneha Rani)
--   Student  9200000001 / Student@123   (Arjun Mehta)
--   Student  9200000002 / Student@123   (Divya Nair)
--
-- The password_hash values below are real bcrypt hashes (cost 10).
-- ============================================================

-- ------------------------------------------------------------
-- Campus + gates
-- ------------------------------------------------------------
INSERT INTO campuses (name, city) VALUES
  ('Main Campus', 'Vellore');

INSERT INTO gates (campus_id, name) VALUES
  (1, 'Main Gate'),
  (1, 'Gate 1A');

-- ------------------------------------------------------------
-- Hostels + blocks
-- Girls: A-J, Boys: A-T (matching the original dropdown, but now
-- as distinct rows so the two "Block A"s can never be confused).
-- ------------------------------------------------------------
INSERT INTO hostels (campus_id, name, gender) VALUES
  (1, 'Girls Hostel', 'girls'),
  (1, 'Boys Hostel',  'boys');

INSERT INTO blocks (hostel_id, name)
SELECT 1, letter FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J']) AS letter;

INSERT INTO blocks (hostel_id, name)
SELECT 2, letter FROM unnest(ARRAY['A','B','C','D','E','F','G','H','I','J',
                                   'K','L','M','N','O','P','Q','R','S','T']) AS letter;

-- ------------------------------------------------------------
-- Users
-- ------------------------------------------------------------
INSERT INTO users (name, phone, password_hash, role, campus_id, default_block_id, room_number) VALUES
  ('Campus Admin', '9000000001',
   '$2b$10$uccasPxFEdq2YmxMNKlPDe1ypQpBt/nXIwOYyGYr3VjLmPqD7gZTa', 'admin',   1, NULL, NULL),
  ('Ravi Kumar',   '9100000001',
   '$2b$10$jFCBZbcmtVngHykzRKpQiudeySt2FQLswyGT8ldlA7cdY06IQUZ7W', 'partner', 1, NULL, NULL),
  ('Sneha Rani',   '9100000002',
   '$2b$10$jFCBZbcmtVngHykzRKpQiudeySt2FQLswyGT8ldlA7cdY06IQUZ7W', 'partner', 1, NULL, NULL),
  ('Arjun Mehta',  '9200000001',
   '$2b$10$Obl5/Z0Zrv1vypZ9mEMQFeLOaB1OnKTqBEQn0TzbepHUNGossSO2q', 'student', 1,
   (SELECT id FROM blocks WHERE hostel_id = 2 AND name = 'C'), '312'),
  ('Divya Nair',   '9200000002',
   '$2b$10$Obl5/Z0Zrv1vypZ9mEMQFeLOaB1OnKTqBEQn0TzbepHUNGossSO2q', 'student', 1,
   (SELECT id FROM blocks WHERE hostel_id = 1 AND name = 'B'), '108');

-- ------------------------------------------------------------
-- Sample orders, one per interesting state, so every dashboard
-- has something real to show the first time you open it.
-- ------------------------------------------------------------

-- 1. Just created, external partner not at the gate yet.
INSERT INTO orders (student_id, campus_id, gate_id, block_id, room_number, vendor,
                    item_description, contact_phone, expected_arrival, notes, status)
VALUES (4, 1, 1, (SELECT id FROM blocks WHERE hostel_id = 2 AND name = 'C'), '312',
        'Swiggy', 'Chicken biryani, 1 large', '9200000001',
        now() + interval '35 minutes', 'Please call once you reach the gate.', 'CREATED');

-- 2. Waiting at the main gate - shows up in the partner pool.
INSERT INTO orders (student_id, campus_id, gate_id, block_id, room_number, vendor,
                    item_description, contact_phone, expected_arrival, notes, status)
VALUES (5, 1, 1, (SELECT id FROM blocks WHERE hostel_id = 1 AND name = 'B'), '108',
        'Blinkit', 'Groceries, 2 bags', '9200000002',
        now() + interval '10 minutes', 'Two bags, one is heavy.', 'WAITING_AT_MAIN_GATE');

-- 3. Out for delivery, carried by Ravi.
INSERT INTO orders (student_id, campus_id, gate_id, block_id, room_number, vendor,
                    item_description, contact_phone, expected_arrival, notes, status)
VALUES (4, 1, 2, (SELECT id FROM blocks WHERE hostel_id = 2 AND name = 'C'), '312',
        'Amazon', 'Small parcel - headphones', '9200000001',
        now() - interval '5 minutes', NULL, 'OUT_FOR_DELIVERY');

INSERT INTO delivery_assignments (order_id, partner_id, assigned_by) VALUES (3, 2, NULL);

-- 4. Completed delivery by Sneha, so stats are not all zero.
INSERT INTO orders (student_id, campus_id, gate_id, block_id, room_number, vendor,
                    item_description, contact_phone, expected_arrival, notes,
                    status, delivered_at)
VALUES (5, 1, 1, (SELECT id FROM blocks WHERE hostel_id = 1 AND name = 'B'), '108',
        'Zomato', 'Paneer roll x2', '9200000002',
        now() - interval '3 hours', NULL,
        'DELIVERED', now() - interval '2 hours 40 minutes');

INSERT INTO delivery_assignments (order_id, partner_id, assigned_by, is_active, released_at)
VALUES (4, 3, NULL, FALSE, now() - interval '2 hours 40 minutes');

-- ------------------------------------------------------------
-- Tracking history for the seeded orders
-- ------------------------------------------------------------
INSERT INTO tracking_events (order_id, status, note, actor_id, created_at) VALUES
  (1, 'CREATED',              'Delivery request created',            4, now() - interval '2 minutes'),

  (2, 'CREATED',              'Delivery request created',            5, now() - interval '20 minutes'),
  (2, 'WAITING_AT_MAIN_GATE', 'External partner reached Main Gate',  5, now() - interval '4 minutes'),

  (3, 'CREATED',              'Delivery request created',            4, now() - interval '50 minutes'),
  (3, 'WAITING_AT_MAIN_GATE', 'External partner reached Gate 1A',    4, now() - interval '30 minutes'),
  (3, 'ASSIGNED',             'Accepted by Ravi Kumar',              2, now() - interval '25 minutes'),
  (3, 'PICKED_UP',            'Collected from Gate 1A',              2, now() - interval '18 minutes'),
  (3, 'OUT_FOR_DELIVERY',     'On the way to Boys Hostel Block C',   2, now() - interval '12 minutes'),

  (4, 'CREATED',              'Delivery request created',            5, now() - interval '3 hours 30 minutes'),
  (4, 'WAITING_AT_MAIN_GATE', 'External partner reached Main Gate',  5, now() - interval '3 hours 10 minutes'),
  (4, 'ASSIGNED',             'Accepted by Sneha Rani',              3, now() - interval '3 hours 5 minutes'),
  (4, 'PICKED_UP',            'Collected from Main Gate',            3, now() - interval '3 hours'),
  (4, 'OUT_FOR_DELIVERY',     'On the way to Girls Hostel Block B',  3, now() - interval '2 hours 55 minutes'),
  (4, 'REACHED_HOSTEL_GATE',  'Waiting at Girls Hostel gate',        3, now() - interval '2 hours 45 minutes'),
  (4, 'DELIVERED',            'Handed over to student',              3, now() - interval '2 hours 40 minutes');
