#!/usr/bin/env python3
"""
Script to add country_name field to the country_status collection
using data from countries_cache.json
"""

import json
import pymongo
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def load_countries_cache():
    """Load countries data from cache file"""
    try:
        with open('countries_cache.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print("Error: countries_cache.json not found")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return None

def connect_to_mongodb():
    """Connect to MongoDB database"""
    try:
        # Get MongoDB URI from environment or use default
        mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/address_db')
        client = MongoClient(mongo_uri)
        
        # Test connection
        client.admin.command('ping')
        print("Successfully connected to MongoDB")
        
        # Get database and collection
        db = client.address_db
        collection = db.country_status  # Changed to country_status collection
        
        return client, collection
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        return None, None

def update_country_names(collection, countries_data):
    """Update documents in the country_status collection with country names"""
    
    print("Starting country name updates for country_status collection...")
    
    # Get all documents from the collection
    documents = list(collection.find({}))
    print(f"Found {len(documents)} documents in country_status collection")
    
    updated_count = 0
    not_found_countries = []
    
    for doc in documents:
        country_code = doc.get('country_code')
        
        if not country_code:
            print(f"Warning: Document {doc['_id']} has no country_code field")
            continue
            
        if country_code in countries_data:
            country_name = countries_data[country_code]['name']
            
            # Update this specific document
            result = collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"country_name": country_name}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"Updated document for {country_code} ({country_name}) - Status: {doc.get('status', 'N/A')}")
            
        else:
            not_found_countries.append(country_code)
            print(f"Warning: Country code '{country_code}' not found in cache")
    
    print(f"\nUpdate completed!")
    print(f"Total documents updated: {updated_count}")
    
    if not_found_countries:
        print(f"Countries not found in cache: {list(set(not_found_countries))}")
    
    return updated_count

def verify_updates(collection):
    """Verify that the updates were successful"""
    print("\nVerifying updates...")
    
    # Count documents with country_name field
    with_country_name = collection.count_documents({"country_name": {"$exists": True}})
    total_documents = collection.count_documents({})
    
    print(f"Documents with country_name: {with_country_name}")
    print(f"Total documents: {total_documents}")
    
    if with_country_name == total_documents:
        print("✅ All documents have been updated successfully!")
    else:
        print(f"⚠️  {total_documents - with_country_name} documents still missing country_name")
    
    # Show sample of updated documents
    print("\nSample of updated documents:")
    sample_docs = collection.find({"country_name": {"$exists": True}}).limit(5)
    for doc in sample_docs:
        print(f"  {doc['country_code']} -> {doc['country_name']} | Status: {doc.get('status', 'N/A')} | Worker: {doc.get('worker_id', 'N/A')}")

def analyze_collection(collection):
    """Analyze the current state of the collection"""
    print("\n=== Country Status Collection Analysis ===")
    
    # Total document count
    total_docs = collection.count_documents({})
    print(f"Total documents: {total_docs}")
    
    # Check if country_name field exists
    with_country_name = collection.count_documents({"country_name": {"$exists": True}})
    without_country_name = total_docs - with_country_name
    
    print(f"Documents with country_name: {with_country_name}")
    print(f"Documents without country_name: {without_country_name}")
    
    # Status distribution
    print("\n=== Status Distribution ===")
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    status_dist = list(collection.aggregate(pipeline))
    for status in status_dist:
        print(f"{status['_id']}: {status['count']} countries")
    
    # Show all countries
    print("\n=== All Countries ===")
    all_docs = collection.find({}).sort("country_code", 1)
    for doc in all_docs:
        country_name = doc.get('country_name', 'NOT SET')
        print(f"{doc['country_code']}: {country_name} | Status: {doc.get('status', 'N/A')}")

def main():
    """Main function"""
    print("=== Adding Country Names to Country Status Collection ===\n")
    
    # Load countries data
    print("Loading countries cache...")
    countries_data = load_countries_cache()
    if not countries_data:
        return
    
    print(f"Loaded {len(countries_data)} countries from cache")
    
    # Connect to MongoDB
    print("\nConnecting to MongoDB...")
    client, collection = connect_to_mongodb()
    if collection is None:
        return
    
    try:
        # Analyze current state
        analyze_collection(collection)
        
        # Ask for confirmation
        print("\n" + "="*50)
        response = input("Do you want to proceed with updating country names? (y/N): ")
        if response.lower() != 'y':
            print("Operation cancelled.")
            return
        
        # Update country names
        updated_count = update_country_names(collection, countries_data)
        
        # Verify updates
        verify_updates(collection)
        
        print(f"\n✅ Script completed successfully! Updated {updated_count} documents.")
        
    except Exception as e:
        print(f"Error during update process: {e}")
    
    finally:
        # Close connection
        if client is not None:
            client.close()
            print("\nMongoDB connection closed.")

if __name__ == "__main__":
    main()