import Link from 'next/link';

export default function PublicLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Welcome to Splint Factory
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Public Landing Page
          </p>
          
          <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
            <Link
              href="/register"
              className="w-full sm:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold border-2 border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 py-16">
          <div className="text-center">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3">Design Tools</h3>
              <p className="text-gray-600">Advanced CAD tools for precise splint design</p>
            </div>
          </div>
          <div className="text-center">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3">3D Printing</h3>
              <p className="text-gray-600">Direct integration with 3D printing services</p>
            </div>
          </div>
          <div className="text-center">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-semibold mb-3">Quality Assured</h3>
              <p className="text-gray-600">Medical-grade materials and certification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
