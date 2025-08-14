import Link from 'next/link';
import Header from '@/components/navigation/Header';

export default function PublicLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header variant="browser" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-12 pb-16 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Welcome to Splint Factory
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Advanced CAD tools for precise medical splint design and 3D printing.
          </p>
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
