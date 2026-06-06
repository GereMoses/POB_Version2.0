"""
Database Migration Script for Creating Performance Indexes
Run this script to create all necessary database indexes
"""

import sys
import os

# Add the parent directory to the path so we can import from the app
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from sqlalchemy import create_engine, text
from app.core.config import settings
from app.database.indexes import create_indexes, analyze_indexes

def main():
    """Main migration function"""
    print("🚀 Starting database index migration...")
    
    # Create database engine
    engine = create_engine(settings.DATABASE_URL)
    
    # Create indexes
    with engine.connect() as connection:
        print("📊 Creating database indexes for performance optimization...")
        success = create_indexes(connection)
        
        if success:
            print("✅ Index creation completed successfully!")
            
            # Analyze index usage
            print("\n📈 Analyzing index usage...")
            analysis = analyze_indexes(connection)
            
            if "error" not in analysis:
                print(f"✅ Found {len(analysis['index_usage'])} active indexes")
                print(f"⚠️  Found {len(analysis['unused_indexes'])} unused indexes")
                print(f"📊 Analyzed {len(analysis['table_sizes'])} tables")
                
                # Show unused indexes
                if analysis['unused_indexes']:
                    print("\n⚠️  Unused indexes (consider dropping):")
                    for idx in analysis['unused_indexes']:
                        print(f"  - {idx['schema']}.{idx['table']}.{idx['index']} ({idx['size']})")
                
                # Show largest tables
                print("\n📊 Largest tables by size:")
                for table in analysis['table_sizes'][:5]:
                    print(f"  - {table['table']}: {table['total_size']} (indexes: {table['indexes_size']})")
            else:
                print(f"❌ Error analyzing indexes: {analysis['error']}")
        else:
            print("❌ Index creation failed!")
            sys.exit(1)

if __name__ == "__main__":
    main()
