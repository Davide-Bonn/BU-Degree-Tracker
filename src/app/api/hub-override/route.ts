import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE = path.join(process.cwd(), "data", "hub-overrides.json");

interface Override {
  id: string;
  hubCode: string;
  courseName: string;
  note: string;
}

function read(): Override[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch {
    return [];
  }
}

function write(data: Override[]) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export async function GET() {
  return NextResponse.json(read());
}

export async function POST(req: Request) {
  const { hubCode, courseName, note = "" } = await req.json();
  if (!hubCode || !courseName) {
    return NextResponse.json({ error: "hubCode and courseName required" }, { status: 400 });
  }
  const overrides = read();
  const newEntry: Override = {
    id: Date.now().toString(),
    hubCode,
    courseName: courseName.trim(),
    note: note.trim(),
  };
  overrides.push(newEntry);
  write(overrides);
  return NextResponse.json(newEntry);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const overrides = read().filter((o) => o.id !== id);
  write(overrides);
  return NextResponse.json({ ok: true });
}
