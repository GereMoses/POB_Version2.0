#!/usr/bin/env python3
"""
Payroll Module Quick Setup Script
Automated setup and validation for the BioTime 9.5 Payroll Module
"""

import sys
import os
import subprocess
import platform

def print_header(title):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"🚀 {title}")
    print("=" * 60)

def print_success(message):
    """Print success message"""
    print(f"✅ {message}")

def print_error(message):
    """Print error message"""
    print(f"❌ {message}")

def print_info(message):
    """Print info message"""
    print(f"ℹ️  {message}")

def check_python_version():
    """Check Python version compatibility"""
    print_info("Checking Python version...")
    
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print_success(f"Python {version.major}.{version.minor}.{version.micro} is compatible")
        return True
    else:
        print_error(f"Python {version.major}.{version.minor}.{version.micro} is not compatible")
        print_info("Please upgrade to Python 3.8 or higher")
        return False

def install_dependencies():
    """Install required dependencies"""
    print_header("Installing Payroll Dependencies")
    
    try:
        # Check if pip is available
        subprocess.run([sys.executable, "-m", "pip", "--version"], 
                       check=True, capture_output=True)
        
        # Install requirements
        requirements_file = "requirements_payroll.txt"
        if os.path.exists(requirements_file):
            print_info(f"Installing dependencies from {requirements_file}...")
            result = subprocess.run([sys.executable, "-m", "pip", "install", "-r", requirements_file], 
                                  capture_output=True, text=True)
            
            if result.returncode == 0:
                print_success("Dependencies installed successfully")
                return True
            else:
                print_error(f"Failed to install dependencies: {result.stderr}")
                return False
        else:
            print_error(f"Requirements file {requirements_file} not found")
            return False
            
    except subprocess.CalledProcessError as e:
        print_error(f"Pip not available: {e}")
        return False

def validate_imports():
    """Validate all payroll module imports"""
    print_header("Validating Payroll Module Imports")
    
    imports_to_test = [
        ("Formula Engine", "app.services.payroll_formula_engine"),
        ("Payroll Service", "app.services.payroll_service"),
        ("Reports Service", "app.services.payroll_reports_service"),
        ("Loans Service", "app.services.payroll_loans_service"),
        ("API Endpoints", "app.api.payroll"),
        ("Models", "app.models.payroll")
    ]
    
    success_count = 0
    
    for name, module_path in imports_to_test:
        try:
            exec(f"import {module_path}")
            print_success(f"{name} imported successfully")
            success_count += 1
        except ImportError as e:
            print_error(f"{name} import failed: {str(e)}")
        except Exception as e:
            print_error(f"{name} error: {str(e)}")
    
    print_info(f"Import validation: {success_count}/{len(imports_to_test)} passed")
    return success_count == len(imports_to_test)

def test_formula_engine():
    """Test the formula engine basic functionality"""
    print_header("Testing Formula Engine")
    
    try:
        from app.services.payroll_formula_engine import payroll_formula_engine
        
        # Test basic arithmetic
        variables = {"Basic": 1000, "OTHours": 10, "Rate": 1.5}
        result = payroll_formula_engine.evaluate_formula("Basic * 0.4", variables)
        
        if result['success']:
            print_success(f"Formula test passed: Basic * 0.4 = {result['value']}")
            return True
        else:
            print_error(f"Formula test failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print_error(f"Formula engine test failed: {str(e)}")
        return False

def check_database_connection():
    """Check database connection"""
    print_header("Checking Database Connection")
    
    try:
        from app.core.database import test_db_connection
        
        if test_db_connection():
            print_success("Database connection successful")
            return True
        else:
            print_error("Database connection failed")
            return False
            
    except Exception as e:
        print_error(f"Database check failed: {str(e)}")
        return False

def create_database_tables():
    """Create payroll database tables"""
    print_header("Creating Database Tables")
    
    try:
        # Try to import and run the migration
        sys.path.append('database/migrations')
        try:
            import create_payroll_tables
            create_payroll_tables.create_payroll_tables()
            print_success("Database tables created successfully")
            return True
        except ImportError:
            print_error("Migration script not found")
            return False
        except Exception as e:
            print_error(f"Table creation failed: {str(e)}")
            return False
            
    except Exception as e:
        print_error(f"Database setup failed: {str(e)}")
        return False

def validate_frontend():
    """Validate frontend component"""
    print_header("Validating Frontend Component")
    
    frontend_path = "frontend-react/src/pages/Payroll/Payroll.jsx"
    
    if os.path.exists(frontend_path):
        print_success("Frontend component found")
        
        # Check for key features
        with open(frontend_path, 'r') as f:
            content = f.read()
        
        key_features = [
            "Salary Structure", "Attendance Items", "Formula", 
            "Salary Period", "Calculation", "Payslip", 
            "Bank Sheet", "Reports", "Loans/Advances"
        ]
        
        found_features = 0
        for feature in key_features:
            if feature in content:
                found_features += 1
        
        print_info(f"Frontend features: {found_features}/{len(key_features)} found")
        return found_features == len(key_features)
    else:
        print_error("Frontend component not found")
        return False

def run_tests():
    """Run the simple test suite"""
    print_header("Running Test Suite")
    
    try:
        # Try to run the simple test
        result = subprocess.run([sys.executable, "test_payroll_simple.py"], 
                              capture_output=True, text=True)
        
        if result.returncode == 0:
            print_success("Test suite passed")
            print_info(result.stdout)
            return True
        else:
            print_error("Test suite failed")
            print_info(result.stdout)
            print_info(result.stderr)
            return False
            
    except Exception as e:
        print_error(f"Test execution failed: {str(e)}")
        return False

def generate_setup_report():
    """Generate a setup report"""
    print_header("Setup Report")
    
    report = {
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "platform": platform.system(),
        "dependencies_installed": False,
        "imports_valid": False,
        "database_connected": False,
        "tables_created": False,
        "formula_engine_working": False,
        "frontend_validated": False,
        "tests_passed": False
    }
    
    # Update report based on actual checks
    # (This would be populated by the actual setup process)
    
    print_info("Setup report generated")
    return report

def main():
    """Main setup function"""
    print_header("BioTime 9.5 Payroll Module Setup")
    
    steps = [
        ("Python Version Check", check_python_version),
        ("Install Dependencies", install_dependencies),
        ("Validate Imports", validate_imports),
        ("Test Formula Engine", test_formula_engine),
        ("Check Database Connection", check_database_connection),
        ("Create Database Tables", create_database_tables),
        ("Validate Frontend", validate_frontend),
        ("Run Tests", run_tests)
    ]
    
    passed_steps = 0
    total_steps = len(steps)
    
    for step_name, step_func in steps:
        print(f"\n🔄 {step_name}...")
        try:
            if step_func():
                passed_steps += 1
                print_success(f"{step_name} completed")
            else:
                print_error(f"{step_name} failed")
        except Exception as e:
            print_error(f"{step_name} crashed: {str(e)}")
    
    # Final summary
    print_header("Setup Summary")
    print(f"Completed: {passed_steps}/{total_steps} steps")
    
    if passed_steps == total_steps:
        print_success("🎉 Payroll module setup completed successfully!")
        print_info("\nNext steps:")
        print_info("1. Start the backend server: python -m uvicorn app.main:app --reload")
        print_info("2. Start the frontend: npm start (from frontend-react directory)")
        print_info("3. Access payroll at: http://localhost:3000/payroll")
    else:
        print_error(f"⚠️ {total_steps - passed_steps} steps failed")
        print_info("\nTroubleshooting:")
        print_info("1. Check the error messages above")
        print_info("2. Install missing dependencies")
        print_info("3. Start the database server")
        print_info("4. Review the documentation")
    
    # Generate report
    generate_setup_report()

if __name__ == "__main__":
    main()
