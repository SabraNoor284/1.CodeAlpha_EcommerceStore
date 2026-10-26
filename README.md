# CodeAlpha_EcommerceStore

**CodeAlpha Full Stack Development Internship – Task 1: Simple E-commerce Store**

A basic e-commerce site with product listings, product details, shopping cart, order processing and user registration/login.

## Tech stack
- **Frontend:** HTML, CSS, vanilla JavaScript (single-page app with hash routing)
- **Backend:** Node.js + Express.js
- **Database:** SQLite (Node's built-in `node:sqlite`, no native build step) – stores users, products, orders, order items
- **Auth:** bcrypt password hashing + JWT

## Features
- Product listing with search and category filter
- Product details page
- Shopping cart (stored in the browser, quantity limits checked against stock)
- Order processing: prices and totals are recalculated on the server, stock is decremented in a transaction
- User registration / login, order history

## Run it
Requires **Node.js 22.5+**.

```bash
npm install
npm start
# open http://localhost:3001
```

Environment variables (optional): `PORT`, `JWT_SECRET`, `DB_FILE`.
The database file `store.db` is created and seeded with 12 sample products on first start.

## API
| Method | Endpoint | Auth | Description |
|-------:|----------|------|-------------|
| POST | `/api/register` | – | Create account |
| POST | `/api/login` | – | Login, returns JWT |
| GET | `/api/me` | ✔ | Current user |
| GET | `/api/products?q=&category=` | – | List / search products |
| GET | `/api/products/:id` | – | Product details |
| GET | `/api/categories` | – | Categories |
| POST | `/api/orders` | ✔ | Place order `{items:[{productId,quantity}], shipping:{name,address,phone}}` |
| GET | `/api/orders` | ✔ | My orders |
