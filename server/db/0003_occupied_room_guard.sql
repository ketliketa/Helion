CREATE TRIGGER physical_occupancy_guard BEFORE UPDATE OF status ON reservations WHEN NEW.status='in_house' BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM reservations WHERE id<>NEW.id AND room_id=NEW.room_id AND status='in_house') THEN RAISE(ABORT,'ROOM_CONFLICT') END;
END;
