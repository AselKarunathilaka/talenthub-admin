import React from "react";
import { Loader2 } from "lucide-react";


const Loader = () => {
  return (
    <div className="w-full flex flex-col items-center justify-center mt-16">
      <Loader2 className="h-12 w-12 text-blue-800 animate-spin mb-4" />
      <p className="text-gray-600 font-medium">Loading Please Wait...</p>
    </div>
  );
};

export default Loader;
