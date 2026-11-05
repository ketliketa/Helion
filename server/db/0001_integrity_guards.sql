CREATE TRIGGER reservation_insert_guard BEFORE INSERT ON reservations BEGIN
 SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE id=NEW.room_id AND property_id=NEW.property_id AND blocked=0 AND capacity>=NEW.adults) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
 SELECT CASE WHEN NEW.check_out<=NEW.check_in OR NEW.adults<1 OR NEW.total<0 OR NEW.nightly<1 THEN RAISE(ABORT,'INVALID_RESERVATION') END;
 SELECT CASE WHEN NEW.status NOT IN ('cancelled','no_show') AND EXISTS(SELECT 1 FROM reservations WHERE room_id=NEW.room_id AND status NOT IN ('cancelled','no_show') AND check_in<NEW.check_out AND check_out>NEW.check_in) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER reservation_update_guard BEFORE UPDATE ON reservations BEGIN
 SELECT CASE WHEN NEW.version<>OLD.version+1 THEN RAISE(ABORT,'STALE_VERSION') END;
 SELECT CASE WHEN NEW.check_out<=NEW.check_in OR NEW.adults<1 OR NEW.total<0 OR NEW.nightly<1 THEN RAISE(ABORT,'INVALID_RESERVATION') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id AND property_id=NEW.property_id AND capacity>=NEW.adults) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
 SELECT CASE WHEN NEW.status NOT IN ('cancelled','no_show') AND EXISTS(SELECT 1 FROM reservations WHERE id<>NEW.id AND room_id=NEW.room_id AND status NOT IN ('cancelled','no_show') AND check_in<NEW.check_out AND check_out>NEW.check_in) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
 SELECT CASE WHEN NEW.total<(SELECT COALESCE(SUM(amount),0) FROM payments WHERE reservation_id=NEW.id) THEN RAISE(ABORT,'PAYMENT_EXCEEDS') END;
 SELECT CASE WHEN NEW.status='in_house' AND OLD.status='confirmed' AND NOT EXISTS(SELECT 1 FROM rooms WHERE id=NEW.room_id AND housekeeping='clean' AND blocked=0) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
END;
--> statement-breakpoint
CREATE TRIGGER payment_amount_guard BEFORE INSERT ON payments BEGIN
 SELECT CASE WHEN NEW.amount<=0 OR NEW.amount+(SELECT COALESCE(SUM(amount),0) FROM payments WHERE reservation_id=NEW.reservation_id)>(SELECT total FROM reservations WHERE id=NEW.reservation_id) THEN RAISE(ABORT,'PAYMENT_EXCEEDS') END;
 SELECT CASE WHEN (SELECT status FROM reservations WHERE id=NEW.reservation_id) IN ('cancelled','no_show') THEN RAISE(ABORT,'PAYMENT_EXCEEDS') END;
END;
--> statement-breakpoint
CREATE TRIGGER room_block_guard BEFORE UPDATE OF blocked ON rooms WHEN NEW.blocked=1 BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM reservations WHERE room_id=NEW.id AND status IN ('confirmed','in_house') AND check_out>date('now')) THEN RAISE(ABORT,'ROOM_CONFLICT') END;
END;
