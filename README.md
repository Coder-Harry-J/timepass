### How to Customize This Template in 60 Seconds During the Exam

You do **not** need to change any JavaScript variable names or MySQL column names (`name`, `email`, `category`, `details`) during the exam. Just change the visible text labels in `index.html` based on your exam slip.

| If Exam Topic Is... | Change `[BRAND_LOGO]` To... | Change Name Label To... | Change Email Label To... | Change Category Options To... |
|---|---|---|---|---|
| **Library System** | `CityLibrary` | `Book Title` | `Author Name` | `Fiction / Science / CSE` |
| **Hospital Portal** | `CarePlus Hospital` | `Patient Name` | `Patient Email / Phone` | `Cardiology / Dental / General` |
| **Student System** | `EduPortal` | `Student Name` | `Student Email / Roll No` | `CSE / IT / ECE` |
| **Hotel / Event** | `GrandStay Hotel` | `Guest Name` | `Guest Email` | `Deluxe Room / Suite / Standard` |

> **Pro Tip to Strip All Instructional Comments in 2 Seconds:** Before calling the professor for final evaluation, press `Ctrl + H` (Find & Replace) in VS Code, click the `.*` (Regular Expression) icon, type `.*\[REMOVE BEFORE FINAL PRESENTATION\].*\n?` in the **Find** box, leave the **Replace** box empty, and click **Replace All**. Every instructional comment will vanish instantly.

## 1. Folder Structure & Setup Commands

Create a folder named `fsd_project` and place `index.html` and `server.js` inside it:

```text
fsd_project/
├── index.html       # Frontend SPA (Navbar, Home, About, Services, Gallery, Contact + CRUD Table)
├── server.js        # Backend Node.js + Express + MySQL CRUD + Offline JSON Fallback
└── data_backup.json # Auto-created by server.js if MySQL is not running
