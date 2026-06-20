# Rahti Hotels ERP System - Deployment Guide

This guide explains how to deploy the **Rahti Hotels ERP** application from scratch using **Neon (PostgreSQL)**, **Cloudinary (Storage)**, **Koyeb (Backend)**, and **Vercel (Frontend)**.

---

## 1. Database Setup: Neon (PostgreSQL)

Neon provides a fully managed serverless PostgreSQL database.

1. **Sign Up / Log In**: Go to [Neon.tech](https://neon.tech/) and create an account.
2. **Create a Project**:
   - Click **Create Project**.
   - Set the name (e.g., `rahti-hotels-db`).
   - Select the desired region (e.g., Frankfurt/Germany for Europe).
   - Click **Create**.
3. **Get the Connection String**:
   - Under **Connection Details** on the dashboard, choose **Prisma** or **PostgreSQL** from the dropdown.
   - Copy the connection string. It should look like:
     ```
     postgresql://neondb_owner:npg_BiD1mHCeQ5Yk@ep-mute-voice-asm6k93f.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require
     ```
4. **Database Migration**:
   Before deploying the backend application, sync the schema and seed the database using your local setup:
   - Paste the connection string into the `DATABASE_URL` field in the backend `.env` file.
   - Run the following commands inside `rahti-hotels-backend`:
     ```bash
     npx prisma db push
     npx prisma db seed
     ```

---

## 2. Media & Document Storage Setup: Cloudinary

Cloudinary is used to host documents (PDFs, images) uploaded through the HR and operations panels.

1. **Sign Up / Log In**: Create an account on [Cloudinary](https://cloudinary.com/).
2. **Retrieve API Credentials**:
   - Go to your Cloudinary Console dashboard.
   - Copy the following values from the **Product Environment Credentials** section:
     - **Cloud Name** (`CLOUDINARY_CLOUD_NAME`)
     - **API Key** (`CLOUDINARY_API_KEY`)
     - **API Secret** (`CLOUDINARY_API_SECRET`)

---

## 3. Backend Deployment: Koyeb

Koyeb is a modern developer platform used to host Node.js and Docker applications.

1. **Sign Up / Log In**: Create an account on [Koyeb](https://www.koyeb.com/).
2. **Create a Service**:
   - Click **Create Service**.
   - Choose **GitHub** as the deployment method.
   - Connect your GitHub account and select your `rahti-hotels-backend` repository.
3. **Configure Deployment Settings**:
   - **Branch**: Select your main deployment branch (e.g., `main`).
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Port**: Set to `3000` (or the port defined in your express configuration).
4. **Set Environment Variables**:
   Add the following environment variables in Koyeb:
   - `DATABASE_URL`: `postgresql://neondb_owner:npg_BiD1mHCeQ5Yk@ep-mute-voice-asm6k93f.c-4.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - `PORT`: `3000`
   - `JWT_SECRET`: `your-secure-jwt-secret-key` (generate a random string)
   - `WHATSAPP_VERIFY_TOKEN`: `super-secret-verify-token-123`
   - `WHATSAPP_API_TOKEN`: `mock-whatsapp-api-token`
   - `CLOUDINARY_CLOUD_NAME`: `your-cloudinary-cloud-name`
   - `CLOUDINARY_API_KEY`: `your-cloudinary-api-key`
   - `CLOUDINARY_API_SECRET`: `your-cloudinary-api-secret`
   - `GEMINI_API_KEY`: `your-gemini-api-key` (optional, for AI metadata extraction fallback)
5. **Deploy**:
   - Click **Deploy**. Koyeb will automatically build and publish your backend, providing you with a public URL (e.g. `https://rahti-hotels-backend-xxxx.koyeb.app`).

---

## 4. Frontend Deployment: Vercel

Vercel is the recommended hosting platform for Next.js applications.

1. **Sign Up / Log In**: Go to [Vercel](https://vercel.com/) and sign in.
2. **Import Repository**:
   - Click **Add New** -> **Project**.
   - Select your `rahti-hotels-frontend` repository from the connected GitHub account.
3. **Configure Framework Preset**:
   - Ensure the framework preset is set to **Next.js**.
   - Set the root directory if it's a monorepo, or leave as default.
4. **Add Environment Variables**:
   Under the **Environment Variables** section, add:
   - `NEXT_PUBLIC_API_URL`: Set this to your Koyeb backend URL followed by `/api` (e.g., `https://rahti-hotels-backend-xxxx.koyeb.app/api`).
5. **Deploy**:
   - Click **Deploy**. Vercel will build and launch the dashboard. Once complete, it will provide your final frontend URL (e.g. `https://rahti-hotels-frontend.vercel.app`).
