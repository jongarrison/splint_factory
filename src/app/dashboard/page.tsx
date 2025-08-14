import { auth } from "@/lib/auth"
import Link from "next/link"
import SignOutButton from "@/components/auth/SignOutButton"

export default async function Dashboard() {
  const session = await auth()
  // No need to check if session exists - middleware handles authentication

  return (
    <div className="font-sans min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Splint Factory</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {session?.user?.name || session?.user?.email}!
              </span>
              <Link 
                href="/profile" 
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                My Profile
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Welcome to Your Dashboard
          </h2>
          <p className="text-xl text-gray-600 mb-12">
            Your authenticated user dashboard - this is where logged-in users land.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-3">Design Studio</h3>
              <p className="text-gray-600 mb-4">Create and edit splint designs</p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Launch Designer
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-3">My Projects</h3>
              <p className="text-gray-600 mb-4">View and manage your designs</p>
              <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                View Projects
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold mb-3">Print Queue</h3>
              <p className="text-gray-600 mb-4">Manage 3D printing jobs</p>
              <button className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                View Queue
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
