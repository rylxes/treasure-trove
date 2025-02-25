/*
  # Create storage bucket for item images

  1. Storage
    - Creates a public bucket for item images
    - Sets up storage policies for authenticated users
*/

-- Create a public bucket for item images
insert into storage.buckets (id, name, public)
values ('items', 'items', true);

-- Allow authenticated users to upload images
create policy "Authenticated users can upload item images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'items' and
  (storage.foldername(name))[1] = 'items'
);

-- Allow anyone to download images
create policy "Anyone can download item images"
on storage.objects for select
to public
using (bucket_id = 'items');