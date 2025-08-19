export default function Hero() {
    return (
      <div className="text-center py-16">
        <h1 className="text-4xl font-bold text-black dark:text-white">Your Personal <span className="text-blue-600">AI Assistant</span></h1>
        <p className="text-gray-600 mt-4">
          Upload your team's knowledge – documents, notes, emails – and query it like magic.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <button className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">Get Started</button>
          <button className="border px-6 py-2 rounded text-blue-600 border-blue-600 hover:bg-blue-100">Upload Documents</button>
        </div>
      </div>
    );
  }
  