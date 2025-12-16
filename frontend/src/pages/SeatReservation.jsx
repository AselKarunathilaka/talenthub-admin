import React, { useState } from "react";
import Navigation from "../components/Navigation";
import { Ticket, Check } from "lucide-react";

const SeatReservation = () => {
  const totalSeats = 20;

  const [selectedSeats, setSelectedSeats] = useState([]);

  const handleSeatClick = (seatNumber) => {
    if (selectedSeats.includes(seatNumber)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seatNumber));
    } else {
      setSelectedSeats([...selectedSeats, seatNumber]);
    }
  };

  const handleConfirm = () => {
    alert("Reservation Confirmed for seats: " + selectedSeats.join(", "));
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <Navigation />

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:mt-7 lg:px-10">
        <div className="h-16" />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Ticket className="text-blue-600" />
                  Seat Reservation
                </h1>
                <p className="text-gray-600 mt-1">
                  Select your seats and confirm your reservation
                </p>
              </div>
            </div>

            {/* Seat Grid Container */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Available Seats
              </h2>

              <div className="grid grid-cols-5 gap-4 justify-items-center">
                {Array.from({ length: totalSeats }, (_, i) => i + 1).map(
                  (seat) => (
                    <button
                      key={seat}
                      onClick={() => handleSeatClick(seat)}
                      className={`w-16 h-16 rounded-lg border flex items-center justify-center font-medium transition ${
                        selectedSeats.includes(seat)
                          ? "bg-green-500 text-white border-green-600"
                          : "bg-gray-100 hover:bg-gray-200 border-gray-300"
                      }`}
                    >
                      {seat}
                    </button>
                  )
                )}
              </div>

              {/* Selected Seats Display */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border text-center">
                <p className="font-medium text-gray-700">Selected Seats:</p>
                {selectedSeats.length > 0 ? (
                  <p className="text-gray-900 font-semibold mt-1">
                    {selectedSeats.join(", ")}
                  </p>
                ) : (
                  <p className="text-gray-500 mt-1">No seats selected</p>
                )}
              </div>

              {/* Confirm Button */}
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleConfirm}
                  disabled={selectedSeats.length === 0}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all
                    ${
                      selectedSeats.length === 0
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow"
                    }`}
                >
                  <Check /> Confirm Reservation
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SeatReservation;
