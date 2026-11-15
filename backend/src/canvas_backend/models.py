from sqlmodel import SQLModel, Field
from typing import Optional

class PriceBar(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    ticker: str = Field(index=True)
    timestamp: int = Field(index=True)  # Unix timestamp in milliseconds
    open: float
    high: float
    low: float
    close: float
    volume: float
