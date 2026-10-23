const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = 4000;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Create and setup database
const db = new Database("team_directory.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL,
    department  TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    phone       TEXT,
    location    TEXT,
    avatar      TEXT,
    status      TEXT    NOT NULL DEFAULT 'active',
    joined      TEXT    NOT NULL DEFAULT (DATE('now'))
  );
`);

// Seed data if table is empty
const count = db.prepare("SELECT COUNT(*) as cnt FROM employees").get();
if (count.cnt === 0) {
  const insert = db.prepare(`
    INSERT INTO employees (name, role, department, email, phone, location, status, joined)
    VALUES (@name, @role, @department, @email, @phone, @location, @status, @joined)
  `);

  const employees = [
    { name: "Arjun Mehta",   role: "Senior Engineer",      department: "Engineering", email: "arjun.mehta@company.com",   phone: "+91 98765 43210", location: "Hyderabad", status: "active",  joined: "2021-03-15" },
    { name: "Priya Sharma",  role: "UI/UX Designer",       department: "Design",      email: "priya.sharma@company.com",  phone: "+91 87654 32109", location: "Bengaluru", status: "active",  joined: "2020-07-22" },
    { name: "Ravi Kumar",    role: "Product Manager",      department: "Product",     email: "ravi.kumar@company.com",    phone: "+91 76543 21098", location: "Mumbai",    status: "active",  joined: "2019-11-01" },
    { name: "Sneha Patel",   role: "Marketing Lead",       department: "Marketing",   email: "sneha.patel@company.com",   phone: "+91 65432 10987", location: "Ahmedabad", status: "away",    joined: "2022-01-10" },
    { name: "Vikram Nair",   role: "HR Manager",           department: "HR",          email: "vikram.nair@company.com",   phone: "+91 54321 09876", location: "Chennai",   status: "active",  joined: "2018-06-05" },
    { name: "Ananya Iyer",   role: "Finance Analyst",      department: "Finance",     email: "ananya.iyer@company.com",   phone: "+91 43210 98765", location: "Pune",      status: "active",  joined: "2023-02-28" },
    { name: "Deepak Rao",    role: "Backend Engineer",     department: "Engineering", email: "deepak.rao@company.com",    phone: "+91 32109 87654", location: "Hyderabad", status: "offline", joined: "2020-09-14" },
    { name: "Kavya Reddy",   role: "Content Strategist",   department: "Marketing",   email: "kavya.reddy@company.com",   phone: "+91 21098 76543", location: "Bengaluru", status: "active",  joined: "2022-08-19" },
    { name: "Suresh Babu",   role: "DevOps Engineer",      department: "Engineering", email: "suresh.babu@company.com",   phone: "+91 10987 65432", location: "Chennai",   status: "active",  joined: "2021-12-03" },
    { name: "Meera Joshi",   role: "Product Designer",     department: "Design",      email: "meera.joshi@company.com",   phone: "+91 99876 54321", location: "Mumbai",    status: "away",    joined: "2023-05-11" },
    { name: "Aditya Singh",  role: "Financial Controller", department: "Finance",     email: "aditya.singh@company.com",  phone: "+91 88765 43210", location: "Delhi",     status: "active",  joined: "2019-04-22" },
    { name: "Nisha Thomas",  role: "Talent Acquisition",   department: "HR",          email: "nisha.thomas@company.com",  phone: "+91 77654 32109", location: "Kochi",     status: "active",  joined: "2020-03-17" },
  ];

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(employees);
  console.log("✅ Seeded 12 employees");
}

// GET all employees
app.get("/api/employees", (req, res) => {
  const { search = "", department = "", status = "" } = req.query;
  let query = "SELECT * FROM employees WHERE 1=1";
  const params = [];

  if (search) {
    query += " AND (name LIKE ? OR role LIKE ? OR email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (department && department !== "All") {
    query += " AND department = ?";
    params.push(department);
  }
  if (status && status !== "All") {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY name";
  const employees = db.prepare(query).all(...params);
  res.json(employees);
});

// GET single employee
app.get("/api/employees/:id", (req, res) => {
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  res.json(employee);
});

// POST create new employee
app.post("/api/employees", (req, res) => {
  const { name, role, department, email, phone, location, status, joined } = req.body;
  if (!name || !role || !department || !email) {
    return res.status(400).json({ error: "name, role, department and email are required" });
  }
  try {
    const result = db.prepare(`
      INSERT INTO employees (name, role, department, email, phone, location, status, joined)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, role, department, email, phone || null, location || null, status || "active", joined || new Date().toISOString().split("T")[0]);

    const created = db.prepare("SELECT * FROM employees WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(409).json({ error: "Email already exists" });
    res.status(500).json({ error: err.message });
  }
});

// PATCH update employee
app.patch("/api/employees/:id", (req, res) => {
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });

  const { name, role, department, email, phone, location, status } = req.body;
  db.prepare(`
    UPDATE employees SET name=?, role=?, department=?, email=?, phone=?, location=?, status=? WHERE id=?
  `).run(
    name || employee.name,
    role || employee.role,
    department || employee.department,
    email || employee.email,
    phone || employee.phone,
    location || employee.location,
    status || employee.status,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// DELETE employee
app.delete("/api/employees/:id", (req, res) => {
  const employee = db.prepare("SELECT * FROM employees WHERE id = ?").get(req.params.id);
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// GET stats
app.get("/api/stats", (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active'  THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'away'    THEN 1 ELSE 0 END) as away,
      SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
      COUNT(DISTINCT department) as departments
    FROM employees
  `).get();
  res.json(stats);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});