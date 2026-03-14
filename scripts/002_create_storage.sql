-- Create storage bucket for arrangement images
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to view images
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT 
USING (bucket_id = 'images');

-- Allow anyone to upload images
CREATE POLICY "Allow uploads" ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'images');

-- Allow anyone to update their uploads
CREATE POLICY "Allow updates" ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'images');

-- Allow anyone to delete their uploads
CREATE POLICY "Allow deletes" ON storage.objects 
FOR DELETE 
USING (bucket_id = 'images');
