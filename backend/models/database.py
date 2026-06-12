import sqlite3
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel


class Transaction(BaseModel):
    id: Optional[int] = None
    date: str
    amount: float
    category: str
    vendor: str
    description: str
    source_document: Optional[str] = None
    created_at: Optional[str] = None


class Database:
    def __init__(self, db_path: str = "hisabvani.db"):
        self.db_path = db_path
        self.init_db()

    def init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    amount REAL NOT NULL,
                    category TEXT NOT NULL,
                    vendor TEXT NOT NULL,
                    description TEXT NOT NULL,
                    source_document TEXT,
                    created_at TEXT NOT NULL
                )
            """)
            conn.commit()

    def add_transaction(self, transaction: Transaction) -> int:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                INSERT INTO transactions (date, amount, category, vendor, description, source_document, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    transaction.date,
                    transaction.amount,
                    transaction.category,
                    transaction.vendor,
                    transaction.description,
                    transaction.source_document,
                    datetime.now().isoformat()
                )
            )
            conn.commit()
            return cursor.lastrowid

    def get_transactions(self, limit: int = 100) -> List[Transaction]:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT id, date, amount, category, vendor, description, source_document, created_at FROM transactions ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()
            return [
                Transaction(
                    id=row[0],
                    date=row[1],
                    amount=row[2],
                    category=row[3],
                    vendor=row[4],
                    description=row[5],
                    source_document=row[6],
                    created_at=row[7]
                )
                for row in rows
            ]

    def get_total_expenses(self) -> float:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute("SELECT SUM(amount) FROM transactions")
            result = cursor.fetchone()[0]
            return result if result else 0.0

    def get_expenses_by_category(self) -> dict:
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "SELECT category, SUM(amount) FROM transactions GROUP BY category"
            )
            return {row[0]: row[1] for row in cursor.fetchall()}
