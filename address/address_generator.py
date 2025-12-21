import json
import requests
import re
import random
import math
import threading
import queue
from typing import List, Dict, Optional, Any, Set
from pymongo import MongoClient
from datetime import datetime
import time

class ImprovedAddressGenerator:
    def __init__(self, mongodb_uri: str = "mongodb://admin:wkrjk!20020415@localhost:27017/address_db?authSource=admin", 
                 database_name: str = "address_db", 
                 collection_name: str = "address",
                 worker_id: int = 11):
        self.mongodb_uri = mongodb_uri
        self.database_name = database_name
        self.collection_name = collection_name
        self.worker_id = worker_id
        self.photon_url = "https://photon.komoot.io/api/"
        self.max_bbox_area = 100  # 100m²
        
        # Error handling thread
        self.error_queue = queue.Queue()
        self.error_thread = threading.Thread(target=self._error_handler, daemon=True)
        self.error_thread.start()
        
        # Load country and city data
        self.country_city_data = self._load_country_city_data()
        
        # MongoDB connection
        self.client = MongoClient(self.mongodb_uri)
        self.db = self.client[self.database_name]
        self.collection = self.db[self.collection_name]
        
        try:
            # Try to create unique index, but don't fail if duplicates exist
            self.collection.create_index("fulladdress", unique=True)
            print("Created unique index on 'fulladdress' field")
        except Exception as e:
            # Send error to error thread instead of logging
            self.error_queue.put(('index_creation', str(e)))
            # Try to create a non-unique index for performance
            try:
                self.collection.create_index("fulladdress", unique=False)
            except Exception as e2:
                self.error_queue.put(('index_creation_fallback', str(e2)))
        
        # Track processed addresses to avoid duplicates in current session
        self.processed_addresses: Set[str] = set()
    
    def _error_handler(self):
        """Background thread to handle errors silently"""
        while True:
            try:
                error_type, error_msg = self.error_queue.get(timeout=1)
                # Silently handle errors - could write to file, send to monitoring, etc.
                # For now, just consume them silently
                pass
            except queue.Empty:
                continue
            except Exception:
                # Even error handling errors are silent
                pass
    
    def _load_country_city_data(self) -> Dict:
        """Load country and city data from JSON file"""
        try:
            with open('country_city_list.json', 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            self.error_queue.put(('file_not_found', 'country_city_list.json not found'))
            return {}
    
    def looks_like_address(self, address: str) -> bool:
        """Validate if string looks like a real address"""
        address = address.strip().lower()

        address_len = re.sub(r'[^\w]', '', address.strip(), flags=re.UNICODE)
        if len(address_len) < 30 or len(address_len) > 300:
            return False

        letter_count = len(re.findall(r'[^\W\d]', address, flags=re.UNICODE))
        if letter_count < 20:
            return False

        if re.match(r"^[^a-zA-Z]*$", address) or len(set(address)) < 5:
            return False
            
        address_for_number_count = address.replace('-', '').replace(';', '')
        sections = [s.strip() for s in address_for_number_count.split(',')]
        sections_with_numbers = [s for s in sections if re.findall(r"[0-9]+", s)]
        
        if len(sections_with_numbers) < 1 or address.count(",") < 2:
            return False
        
        special_chars = ['`', ':', '%', '@', '*', '^', '[', ']', '{', '}', '_', '«', '»']
        if any(char in address for char in special_chars):
            return False
        
        return True
    
    def get_cities_for_country(self, country_name: str) -> List[str]:
        """Get list of cities for a given country"""
        for country_code, country_data in self.country_city_data.items():
            if country_data['country_name'].lower() == country_name.lower():
                return country_data['cities']
        
        self.error_queue.put(('country_not_found', f"Country '{country_name}' not found in data"))
        return []
    
    def get_random_cities(self, country_name: str, max_cities: int = None) -> List[str]:
        """Get randomized list of cities for a country"""
        cities = self.get_cities_for_country(country_name)
        if not cities:
            return []
        
        # Shuffle the cities for randomness
        random.shuffle(cities)
        
        # Limit number of cities if specified
        if max_cities and len(cities) > max_cities:
            cities = cities[:max_cities]
        
        print(f"Selected {len(cities)} random cities from {country_name}")
        return cities
    

    
    def query_photon_api(self, query: str, limit: int = 50) -> Optional[Dict]:
        """Query Photon API for addresses with a specific query"""
        
        params = {
            'q': query,
            'osm_tag': 'building',
            'limit': limit
        }
        
        # Add browser-like headers to avoid bot detection
        headers = {
            'User-Agent': 'https://github.com/yanez-compliance/MIID-subnet_1',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Referer': 'https://photon.komoot.io/'
        }
        
        try:
            response = requests.get(self.photon_url, params=params, headers=headers, timeout=20)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 403:
                self.error_queue.put(('api_forbidden', f"Photon API access forbidden (403) for query: '{query}'"))
                return None
            else:
                self.error_queue.put(('api_error', f"Photon API returned status {response.status_code} for query: '{query}'"))
                return None
        except requests.RequestException as e:
            self.error_queue.put(('api_exception', f"Error querying Photon API for query '{query}': {str(e)}"))
            return None
    
    def calculate_bbox_area(self, extent: List[float]) -> float:
        """Calculate bounding box area in square meters"""
        if not extent or len(extent) != 4:
            return float('inf')
        
        min_lon, min_lat, max_lon, max_lat = extent
        
        lat_diff = abs(max_lat - min_lat)
        lon_diff = abs(max_lon - min_lon)
        
        lat_meters = lat_diff * 111000
        avg_lat = (min_lat + max_lat) / 2
        lon_meters = lon_diff * 111000 * math.cos(math.radians(avg_lat))
        
        return lat_meters * lon_meters
    
    def filter_by_bbox(self, features: List[Dict]) -> List[Dict]:
        """Filter features by bounding box area and randomize order"""
        filtered = []
        
        for feature in features:
            extent = feature.get('properties', {}).get('extent')
            if extent:
                area = self.calculate_bbox_area(extent)
                if area <= self.max_bbox_area:
                    filtered.append(feature)
        
        # Randomize the order of filtered features
        random.shuffle(filtered)
        return filtered
    
    def create_address_document(self, feature: Dict) -> Optional[Dict]:
        """Create address document from Photon feature with validation"""
        props = feature.get('properties', {})
        
        # Validate required fields: country, city, street must exist
        country = props.get('country')
        city = props.get('city')
        street = props.get('street')
        
        if not country or not city or not street:
            # Send to error thread instead of logging
            self.error_queue.put(('missing_fields', f"Missing required fields (country: {country}, city: {city}, street: {street})"))
            return None
        
        osm_type = props.get('osm_type', '')
        osm_id = props.get('osm_id', '')
        
        # Skip if missing OSM data
        if not osm_type or not osm_id:
            self.error_queue.put(('missing_osm', "Missing OSM type or ID"))
            return None
            
        osm = f"{osm_type} {osm_id}"
        
        # Build full address
        address_parts = []
        for field in ['name', 'housenumber', 'street', 'locality', 'district', 'city', 'state', 'postcode', 'country']:
            value = props.get(field)
            if value:
                address_parts.append(str(value))
        
        fulladdress = ", ".join(address_parts)
        
        # Check validation and uniqueness
        if (not fulladdress or 
            len(fulladdress.strip()) < 10 or
            not self.looks_like_address(fulladdress) or
            fulladdress in self.processed_addresses):
            return None
        
        # Mark fulladdress as processed
        self.processed_addresses.add(fulladdress)
        
        return {
            'osm': osm,
            'country': props.get('countrycode', 'Unknown'),
            'country_name': props.get('country', 'Unknown'),
            'city': props.get('city', 'Unknown'),
            'street_name': props.get('street'),
            'status': 0,
            'worker_id': self.worker_id,
            'fulladdress': fulladdress,
            'created_at': datetime.utcnow()
        }
    
    def save_to_mongodb(self, documents: List[Dict]) -> Dict[str, int]:
        """Save address documents to MongoDB with duplicate tracking"""
        if not documents:
            return {'saved': 0, 'duplicates': 0, 'errors': 0}
        
        saved_count = 0
        duplicate_count = 0
        error_count = 0
        
        try:
            # Try bulk insert first for better performance
            result = self.collection.insert_many(documents, ordered=False)
            saved_count = len(result.inserted_ids)
            return {'saved': saved_count, 'duplicates': 0, 'errors': 0}
        except Exception as bulk_error:
            # If bulk insert fails, process individually to track duplicates
            self.error_queue.put(('bulk_insert_failed', 'Bulk insert failed, processing individually'))
            
            for doc in documents:
                try:
                    self.collection.insert_one(doc)
                    saved_count += 1
                except Exception as e:
                    error_str = str(e)
                    if 'duplicate key error' in error_str.lower() or 'E11000' in error_str:
                        duplicate_count += 1
                        # Send duplicate info to error thread
                        self.error_queue.put(('duplicate_address', f"Duplicate: {doc.get('fulladdress', 'Unknown')[:50]}..."))
                    else:
                        error_count += 1
                        self.error_queue.put(('save_error', f"Error saving document: {error_str}"))
            
            return {'saved': saved_count, 'duplicates': duplicate_count, 'errors': error_count}
    
    def generate_addresses_random(self, country_name: str, count: int, 
                                max_cities: int = None, 
                                addresses_per_city: int = 20) -> Dict[str, Any]:
        """
        Generate random, unique addresses by looping through ALL cities until target count is reached
        
        Args:
            country_name: Target country
            count: Number of addresses to generate
            max_cities: Maximum cities to process (None = process ALL cities until count is reached)
            addresses_per_city: Target addresses per city before moving to next
        """
        # print(f"Starting RANDOM address generation for {country_name}, target: {count}")
        
        # Get ALL cities (no limit) and randomize them
        cities = self.get_random_cities(country_name, max_cities=None)  # No city limit
        if not cities:
            return {'error': f'No cities found for country: {country_name}'}
        
        # print(f"Will process ALL {len(cities)} cities until {count} addresses are found")
        
        total_generated = 0
        total_saved = 0
        total_duplicates = 0
        total_errors = 0
        processed_cities = 0
        city_results = {}
        
        # Process ALL cities in random order until target count is reached
        max_attempts_per_city = 3  # Maximum attempts per city if we haven't reached target
        
        for city in cities:
            if total_saved >= count:
                print(f"✓ Target reached! Found {total_saved} addresses from {processed_cities} cities")
                break
            
            print(f"--------------------Processing {city}, {country_name}--------------------")
            city_saved = 0
            city_duplicates = 0
            city_attempts = 0
            
            # Continue processing this city until we get enough addresses or max attempts
            while city_saved < addresses_per_city and total_saved < count and city_attempts < max_attempts_per_city:
                city_attempts += 1
                print(f"City attempt {city_attempts}/{max_attempts_per_city} for {city}")
                
                # Loop through ALL query patterns to get maximum variety
                query_patterns = [
                    f"{city}, {country_name}",                    # Basic query
                    f"house {city}, {country_name}",              # Houses
                    f"apartment {city}, {country_name}",          # Apartments  
                    f"residential {city}, {country_name}",        # Residential areas
                    f"home {city}, {country_name}",               # Homes
                    f"building {city}, {country_name}",           # Buildings
                    f"unit {city}, {country_name}",               # Units/condos
                    f"flat {city}, {country_name}",               # Flats
                    f"condo {city}, {country_name}",              # Condominiums
                    f"townhouse {city}, {country_name}",          # Townhouses
                    f"villa {city}, {country_name}",              # Villas
                    f"duplex {city}, {country_name}",             # Duplexes
                    f"studio {city}, {country_name}",             # Studio apartments
                    f"loft {city}, {country_name}",               # Lofts
                    f"cottage {city}, {country_name}",            # Cottages
                ]
                
                for attempt, query_pattern in enumerate(query_patterns):
                    if city_saved >= addresses_per_city or total_saved >= count:
                        break
                    
                    # Query Photon API with current query pattern
                    photon_data = self.query_photon_api(query_pattern, limit=50)
                    if not photon_data or 'features' not in photon_data:
                        continue
                    
                    features = photon_data['features']
                    # print(f"Attempt {attempt + 1}: Received {len(features)} features")
                    
                    # Filter and randomize
                    filtered_features = self.filter_by_bbox(features)
                    # print(f"After filtering: {len(filtered_features)} features")
                    
                    # Create documents - generate more to account for duplicates
                    documents = []
                    remaining_needed = min(count - total_saved, addresses_per_city - city_saved)
                    target_docs = remaining_needed * 3  # Generate 3x to account for duplicates
                    
                    for feature in filtered_features:
                        if len(documents) >= target_docs:
                            break
                        
                        doc = self.create_address_document(feature)
                        if doc:
                            documents.append(doc)
                    
                    if documents:
                        result = self.save_to_mongodb(documents)
                        saved = result['saved']
                        duplicates = result['duplicates']
                        errors = result['errors']
                        
                        city_saved += saved
                        city_duplicates += duplicates
                        total_saved += saved
                        total_duplicates += duplicates
                        total_errors += errors
                        total_generated += len(documents)
                        
                        print(f"City {city}: Saved {saved} addresses, {duplicates} duplicates (Total: {city_saved})")
                        
                        # If we got good results, continue with this city
                        if saved > 0:
                            continue
                    
                    # Longer delay between attempts to avoid rate limiting
                    time.sleep(1)
                
                # If we didn't get any new addresses in this attempt, break
                if city_saved == 0:
                    print(f"No new addresses found for {city} in attempt {city_attempts}, moving to next city")
                    break
            
            city_results[city] = {
                'saved': city_saved,
                'duplicates': city_duplicates
            }
            processed_cities += 1
            
            print(f"Completed {city}: {city_saved} addresses saved, {city_duplicates} duplicates. Total: {total_saved}/{count}")
            
            # Longer delay between cities to be respectful to API
            time.sleep(2)
        
        return {
            'country': country_name,
            'target_count': count,
            'processed_cities': processed_cities,
            'total_generated': total_generated,
            'total_saved': total_saved,
            'total_duplicates': total_duplicates,
            'total_errors': total_errors,
            'worker_id': self.worker_id,
            'city_breakdown': city_results,
            'randomization': 'enabled'
        }

def main():
    """Example usage - loops through ALL cities until target count is reached"""
    generator = ImprovedAddressGenerator()
    
    # Generate 100 addresses by looping through ALL cities until target is reached
    result = generator.generate_addresses_random(
        country_name="United States", 
        count=100,
        max_cities=None,  # Process ALL cities until count is reached
        addresses_per_city=10
    )
    print(json.dumps(result, indent=2, default=str))

if __name__ == "__main__":
    main()