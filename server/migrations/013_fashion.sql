-- Fashion collections: every shop item can belong to a collection (everyday, traditional, sports, ...) and a sub-collection.
ALTER TABLE avatar_items ADD COLUMN collection TEXT NOT NULL DEFAULT '';
ALTER TABLE avatar_items ADD COLUMN subcollection TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_avatar_items_collection ON avatar_items(collection, subcollection);
