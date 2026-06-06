FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories that the app writes to at runtime
RUN mkdir -p logs uploads/personnel_photos uploads/meeting_qr media/mtd \
    media/custom-attributes media/onboardings media/resignations

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=30s --retries=3 CMD curl -f http://localhost:8000/health || exit 1

# Production: no --reload, explicit host binding
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
