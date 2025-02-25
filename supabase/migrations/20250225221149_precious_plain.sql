/*
  # Create initial categories

  1. Data
    - Insert initial categories for the marketplace
    - Categories: Furniture, Electronics, Home Decor, Kitchen
*/

-- Insert initial categories
INSERT INTO categories (name, slug, description)
VALUES 
  ('Furniture', 'furniture', 'Home and office furniture'),
  ('Electronics', 'electronics', 'Electronic devices and gadgets'),
  ('Home Decor', 'home-decor', 'Decorative items for your home'),
  ('Kitchen', 'kitchen', 'Kitchen appliances and accessories');