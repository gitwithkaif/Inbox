# 📦 Inbox

**Dead-simple personal file requests.** Built with Next.js, Supabase (Auth, Postgres, Storage, Edge Functions), and Resend.

---

## 🎨 Design & Branding
- **Color Palette**:
  - Cream Background: `#f4f1ec`
  - White Cards with thin border: `#ffffff` (`border: #e5e0d8`)
  - Dark Navy Buttons & Text: `#14161f`
  - Warm Orange Accent: `#e08a3c`
  - Green Success States: `#16a34a` / `#22c55e`
- **Branding**: App is named **Inbox** across all page titles, headers, and email notifications.

---

## 🚀 Features

### 1. `/dashboard` (Admin Auth Required)
- **Overview**: Real-time storage usage meter (e.g. `0 B / 1 GB`) summed from all file sizes.
- **New Pouch Form**:
  - Name (required)
  - Message (optional)
  - Custom URL slug (optional, auto-generates URL-safe random slug if blank)
  - "Add password protection" checkbox (reveals password input)
- **Pouches List**:
  - Pouch name, creation date, file count, password badge.
  - "Copy Link" button (copies `yoursite.com/p/[slug]` to clipboard with visual feedback).
  - "View" button to access pouch details.
- **Responsive**: Stacks cleanly down to 375px mobile viewport.

### 2. `/dashboard/pouch/[slug]` (Admin Auth Required)
- Pouch header with creation date, total storage, and password protection badge.
- Share link box with copy button.
- Uploaded files list:
  - File icon, file name, formatted size, sender name, upload timestamp.
  - Secure **Download** button.
  - Empty state: *"No files yet — share your pouch link and files will appear here"*.
- **Password Settings**: Checkbox to toggle protection, input to update or remove password.
- **Danger Zone**: Delete pouch button with confirmation modal (cleans up database records and storage bucket files).

### 3. `/p/[slug]` (Public, No Auth)
- **Password Protection**:
  - Clean lock screen with *"This pouch is password-protected"*, *"Enter the password to access [name]"*, password field, and Unlock button.
  - Graceful error handling for incorrect passwords.
- **Upload Form**:
  - *"🔒 Encrypted & Secure"* badge.
  - Title: *"Upload files for [name]"*.
  - **ONLY two inputs**:
    1. **Your Name** (required).
    2. **Drag-and-Drop Zone**: *"Drag files here or click to browse"*, supports any file type, no size cap enforced in UI.
  - **Per-file progress bar & status**:
    - Real-time progress percentage.
    - Mid-upload network resilience with individual file **Retry** without losing progress of other files.
  - **Completion Screen**:
    - Green checkmark icon.
    - *"All done! Your files have been uploaded to [name]."*
    - *"When you're done uploading, just close this window."*
- **404 Handling**: Clean not-found state for missing or invalid slugs.

### 4. Email Notification (Supabase Edge Function / Resend)
- Triggered whenever a file is uploaded to `files`.
- **Subject**: `"{sender_name} uploaded files to '{pouch_name}'"`
- **Template**:
  - Header: **📦 Inbox** (bold)
  - Subheading: *New files uploaded!*
  - Body: **{sender_name}** uploaded files to your pouch "**{pouch_name}**".
  - Button: Orange *"View Your Pouch →"* linking to `/dashboard/pouch/[slug]`.
  - Footer: *"Inbox — Dead-simple file requests"*.
  - Sender: `Inbox <noreply@yourdomain.com>`

---

## 🛠️ Quick Setup

### 1. Clone & Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project keys and Resend details:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
RESEND_API_KEY=re_...
ADMIN_EMAIL=your-admin-email@domain.com
SENDER_EMAIL=Inbox <onboarding@resend.dev>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database & Storage Setup
Open your Supabase SQL Editor and execute the script in `supabase/schema.sql`:
- Creates `pouches` and `files` tables with indexes.
- Configures Row Level Security (RLS) policies.
- Provisions the `pouch-files` storage bucket and access rules.

### 4. Deploy Supabase Edge Function (Optional)
If using Supabase CLI:
```bash
supabase functions deploy notify-upload --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_... ADMIN_EMAIL=admin@domain.com APP_URL=https://yourdomain.com
```

### 5. Run the Application
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Testing & Verification
- Run tests: `npm test`
- Production build: `npm run build`
