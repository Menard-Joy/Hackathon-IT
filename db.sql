-- USERS: stores all account holders (both Producers and Consumers)
CREATE TABLE Users (
    user_id        INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    role           ENUM('Producer','Consumer') NOT NULL
);

-- PRODUCT CATEGORIES: predefined product types (e.g. Vegetables, Fruits, Herbs, etc.)
CREATE TABLE ProductCategories (
    category_id    INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) UNIQUE NOT NULL
);

-- EXPIRY TYPES: predefined expiry nature (e.g. Short Expiry, Long Expiry)
CREATE TABLE ExpiryTypes (
    expiry_type_id INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(50) UNIQUE NOT NULL
);

-- TALUKS: predefined locations (Taluk list for Trichy region)
CREATE TABLE Taluks (
    taluk_id       INT AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) UNIQUE NOT NULL
);

-- PRODUCTS: each product is organic, tied to one producer, with category, expiry, and taluk
CREATE TABLE Products (
    product_id     INT AUTO_INCREMENT PRIMARY KEY,
    producer_id    INT NOT NULL,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    price          DECIMAL(10,2) NOT NULL,
    quantity       INT DEFAULT 0,
    category_id    INT NOT NULL,
    expiry_type_id INT NOT NULL,
    taluk_id       INT NOT NULL,
    FOREIGN KEY (producer_id)    REFERENCES Users(user_id),
    FOREIGN KEY (category_id)    REFERENCES ProductCategories(category_id),
    FOREIGN KEY (expiry_type_id) REFERENCES ExpiryTypes(expiry_type_id),
    FOREIGN KEY (taluk_id)       REFERENCES Taluks(taluk_id)
);

-- CARTS: one (or more) shopping cart per consumer
CREATE TABLE Carts (
    cart_id        INT AUTO_INCREMENT PRIMARY KEY,
    consumer_id    INT NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consumer_id) REFERENCES Users(user_id)
);

-- CART ITEMS: products added to a cart with quantities
CREATE TABLE CartItems (
    cart_item_id   INT AUTO_INCREMENT PRIMARY KEY,
    cart_id        INT NOT NULL,
    product_id     INT NOT NULL,
    quantity       INT NOT NULL,
    FOREIGN KEY (cart_id)    REFERENCES Carts(cart_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

-- ORDERS: recorded transactions (one per checkout)
CREATE TABLE Orders (
    order_id       INT AUTO_INCREMENT PRIMARY KEY,
    consumer_id    INT NOT NULL,
    order_date     DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount   DECIMAL(10,2),
    FOREIGN KEY (consumer_id) REFERENCES Users(user_id)
);

-- ORDER_ITEMS: each product in an order
CREATE TABLE OrderItems (
    order_item_id  INT AUTO_INCREMENT PRIMARY KEY,
    order_id       INT NOT NULL,
    product_id     INT NOT NULL,
    quantity       INT NOT NULL,
    unit_price     DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES Orders(order_id),
    FOREIGN KEY (product_id) REFERENCES Products(product_id)
);

-- CONTACT FORM: store messages from users to Admin
CREATE TABLE ContactForm (
    contact_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NULL, -- optional: if logged-in user
    name           VARCHAR(150) NOT NULL, -- fallback for guests
    email          VARCHAR(150) NOT NULL,
    subject        VARCHAR(255) NOT NULL,
    message        TEXT NOT NULL,
    submitted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    status         ENUM('Pending','Reviewed','Resolved') DEFAULT 'Pending',
    FOREIGN KEY (user_id) REFERENCES Users(user_id)
);
