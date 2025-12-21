def main(country_name, count):
    import sys
    import json
    import signal
    from address_generator import ImprovedAddressGenerator
    
    # Flag to handle cancellation
    cancelled = False
    
    def signal_handler(signum, frame):
        nonlocal cancelled
        cancelled = True
        print(f"\nProcess cancelled for {country_name}")
        sys.stdout.flush()
        sys.exit(1)
    
    # Register signal handlers for graceful cancellation
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    print(f"Starting address generation for {country_name}")
    print(f"Target count: {count}")
    sys.stdout.flush()
    
    try:
        # Initialize the address generator
        print("Initializing address generator...")
        sys.stdout.flush()
        
        # Suppress some logging to keep output clean
        import logging
        logging.getLogger('address_generator').setLevel(logging.WARNING)
        
        generator = ImprovedAddressGenerator()
        
        # Generate addresses using the random generator
        print("Starting address generation process...")
        print("Note: This may take several minutes depending on the target count and API response times...")
        print("Connecting to Photon API and MongoDB...")
        sys.stdout.flush()
        
        result = generator.generate_addresses_random(
            country_name=country_name,
            count=count,
            max_cities=None,  # Process all cities until target is reached
            addresses_per_city=10  # Reduced to get faster results
        )
        
        # Check if there was an error
        if 'error' in result:
            print(f"Error: {result['error']}")
            sys.stdout.flush()
            return
        
        # Print final results
        print("\n" + "="*50)
        print("GENERATION SUMMARY")
        print("="*50)
        print(f"Country: {country_name}")
        print(f"Target count: {count}")
        print(f"Processed cities: {result.get('processed_cities', 0)}")
        print(f"Total generated: {result.get('total_generated', 0)}")
        print(f"Total saved to database: {result.get('total_saved', 0)}")
        print(f"Worker ID: {result.get('worker_id', 'N/A')}")
        print("="*50)
        print(f"Successfully generated {result.get('total_saved', 0)} addresses for {country_name}")
        print("Address generation completed!")
        sys.stdout.flush()
        
    except KeyboardInterrupt:
        print(f"\nProcess interrupted by user for {country_name}")
        sys.stdout.flush()
        sys.exit(1)
    except Exception as e:
        if not cancelled:
            print(f"Error during address generation: {str(e)}")
            print("Please check your MongoDB connection and internet connectivity.")
            sys.stdout.flush()
            raise

if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python index.py <country_name> <count>")
        sys.exit(1)
    
    country_name = sys.argv[1]
    count = int(sys.argv[2])
    main(country_name, count)