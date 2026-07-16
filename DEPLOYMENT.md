# Deploying Sleeper Cell

Sleeper Cell is split into a **Frontend (React/Vite)** and a **Backend (Node.js/Socket.io)**. 

Because the backend relies on **WebSockets (Socket.io)** for real-time game updates, **you cannot deploy the backend to Vercel**. Vercel uses Serverless Functions, which do not support persistent WebSocket connections.

Instead, the recommended stack is:
1. **Frontend:** Vercel (Free, fast static hosting)
2. **Backend:** Render or Railway (Free/Cheap persistent Node.js hosting)
3. **Database:** Neon or Supabase (Free hosted PostgreSQL database)

---

## Step 1: Database Hosting (Neon or Supabase)

Get a hosted PostgreSQL database to replace your local Docker database.

1. Go to [Neon.tech](https://neon.tech/) or [Supabase.com](https://supabase.com/) and create a free PostgreSQL database.
2. Copy the database connection string. It will look like:
   `postgresql://neondb_owner:password@ep-host.pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`
3. Save this connection string (you will need it for the backend environment variables).
4. Run the schema script `db/init.sql` against your new database using the query editor on their website.

---

## Step 2: Deploy the Backend (Render or Railway)

We will use Render as an example (it has a great free tier).

1. Log in to [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository (`jayyvarmaa/civilmafia`).
4. Configure the Web Service settings:
   - **Name:** `civilmafia-backend`
   - **Root Directory:** `server` *(Important: Point this to the server folder)*
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node index.js` *(Do not use watch mode in production)*
5. Scroll down to **Environment Variables** and add:
   - `DATABASE_URL` = (Your Neon/Supabase connection string from Step 1)
   - `PORT` = `3000`
6. Click **Deploy Web Service**. Render will build and start your server, giving you a URL like `https://civilmafia-backend.onrender.com`.

---

## Step 3: Deploy the Frontend (Vercel)

Now we deploy the frontend static files to Vercel and point them to your Render backend.

1. Log in to [Vercel.com](https://vercel.com/).
2. Click **Add New** -> **Project**.
3. Import your GitHub repository (`jayyvarmaa/civilmafia`).
4. Configure the Project settings:
   - **Root Directory:** Edit this and select the `app` folder.
   - **Framework Preset:** Select **Vite** (should be auto-detected).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Expand the **Environment Variables** section and add:
   - `VITE_SERVER_URL` = (Your Render Backend URL from Step 2, e.g., `https://civilmafia-backend.onrender.com`)
6. Click **Deploy**. Vercel will build the frontend and give you a production URL!
