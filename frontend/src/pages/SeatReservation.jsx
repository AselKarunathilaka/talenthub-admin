import React from "react";
import { X, Armchair, Calendar, Trash2 } from "lucide-react";
import Navigation from "../components/Navigation";
import { useSeatManagement } from "./useSeatManagement";

const InternSeatManagement = () => {
  const {
    showModal,
    currentSeat,
    selectedDate,
    dailyBookings,
    minBookingDate,
    maxBookingDate,
    leftSection,
    rightSection,
    totalUnavailableCount,
    totalAvailableCount,
    TOTAL_SEATS,
    formatDisplayDate,
    handleDateChange,
    handleSeatClick,
    handleModalClose,
    handleDateBookingConfirm,
    handleCancelBooking,
    getSeatStatus,
  } = useSeatManagement();

  const Seat = ({ number, x, y, angle, radius, centerX, centerY }) => {
    const status = getSeatStatus(number);

    let posX = x;
    let posY = y;

    if (
      angle !== undefined &&
      radius !== undefined &&
      centerX !== undefined &&
      centerY !== undefined
    ) {
      posX = centerX + Math.cos((angle * Math.PI) / 180) * radius;
      posY = centerY + Math.sin((angle * Math.PI) / 180) * radius;
    }

    const baseClasses =
      "absolute w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all shadow-md";

    let statusClasses = "";

    if (status === "locked") {
      statusClasses = "bg-gray-500 text-white cursor-not-allowed opacity-80";
    } else if (status === "booked") {
      statusClasses = "bg-red-300 text-white cursor-not-allowed";
    } else {
      statusClasses =
        "bg-cyan-400 text-white hover:bg-cyan-500 hover:scale-105 cursor-pointer";
    }

    return (
      <div
        onClick={() => handleSeatClick(number)}
        className={`${baseClasses} ${statusClasses}`}
        style={{
          left: `${posX - 24}px`,
          top: `${posY - 24}px`,
        }}
        title={
          status === "locked"
            ? `Seat ${number} (Locked)`
            : status === "booked" && dailyBookings[number]
              ? `Your booking - Seat ${number}`
              : status === "booked"
                ? `Seat ${number} (Already Booked)`
                : `Seat ${number} (Available)`
        }
      >
        {/* Show X icon only for booked seats, not for locked seats */}
        {status === "booked" && <X size={12} className="mb-[-2px]" />}

        <Armchair size={16} />

        {/* Always show seat number for all seat types */}
        <span className="text-[10px] mt-0.5">{number}</span>
      </div>
    );
  };

  const BookingModal = () => {
    const handleSubmit = async () => {
      const success = await handleDateBookingConfirm();
      if (success) {
        handleModalClose();
      }
    };

    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
              Book Seat {currentSeat}
            </h2>
            <button
              onClick={handleModalClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-700">
                You are booking seat <strong>{currentSeat}</strong> for
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <strong>{formatDisplayDate(selectedDate)}</strong>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Your intern account will be used automatically
              </p>
            </div>

            <div className="p-3 bg-yellow-50 rounded-md text-sm text-yellow-700">
              ⚠ One seat per intern per day is allowed
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleModalClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md transition-colors"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      <Navigation />{" "}
      <div className="flex-1 w-full lg:mt-20 lg:px-10">
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Armchair className="text-blue-600 h-6 w-6 sm:h-7 sm:w-7" />
                  Intern Seat Reservation
                </h1>
                <p className="text-gray-600 mt-1 text-sm sm:text-base">
                  Streamlined and efficient seat assignment for interns
                </p>
              </div>
            </div>

            <div className="mb-4 sm:mb-6 bg-white rounded-lg shadow-lg p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Calendar className="text-blue-600 h-5 w-5" />
                    Select Booking Date
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Choose a date to view and book available seats
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-700">
                      {totalUnavailableCount}
                    </div>
                    <div className="text-sm text-red-600">
                      Seats Booked / Locked
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">
                      {totalAvailableCount}
                    </div>
                    <div className="text-sm text-green-600">
                      Seats Available
                    </div>
                  </div>
                  <div className="flex justify-center sm:justify-end">
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        min={minBookingDate}
                        max={maxBookingDate}
                        className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-cyan-400 rounded-lg"></div>
                <span className="text-xs sm:text-sm font-medium">
                  Available
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-red-300 rounded-lg"></div>
                <span className="text-xs sm:text-sm font-medium">Booked</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 bg-gray-500 rounded-lg"></div>
                <span className="text-xs sm:text-sm font-medium">Locked</span>
              </div>
            </div>
            {/* Joined Seats Info Banner */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-6 py-4 shadow-sm">
                <div className="text-amber-700">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-amber-900">
                    Joined Seats Information
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Some seats are designed as{" "}
                    <strong>2 seats for 1 table</strong> (joined units).
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="hidden sm:block bg-gray-100 rounded-2xl p-0 overflow-hidden flex items-center justify-center pt-0 pb-8 pr-8">
                <div
                  className="relative mx-auto"
                  style={{
                    width: "100%",
                    maxWidth: "1450px",
                    height: "0",
                    paddingBottom: "60%",
                    minHeight: "400px",
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      transform: "scale(0.8)",
                      transformOrigin: "center center",
                    }}
                  >
                    <div
                      className="absolute top-0 h-12 bg-gray-700  flex items-center"
                      style={{
                        left: "-125px",
                        width: "744px",
                      }}
                    >
                      <div className="text-base lg:text-xl font-bold text-white z-10 pl-4">
                        Entrance
                      </div>
                    </div>
                    <div
                      className="absolute h-12 bg-gray-700 flex items-center"
                      style={{
                        left: "485px",
                        top: "-45px",
                        width: "785px",
                        zIndex: 20,
                      }}
                    ></div>

                    <div
                      className="absolute top-11 w-33 bg-gray-700"
                      style={{
                        left: "486px",
                        bottom: "-100px",
                      }}
                    ></div>

                    <div
                      className="absolute bg-gray-400 rounded-lg"
                      style={{
                        left: "-125px",
                        top: "50px",
                        width: "610px",
                        height: "720px",
                      }}
                    >
                      <div
                        className="absolute bg-gray-600 rounded-full"
                        style={{
                          left: "235px",
                          top: "250px",
                          width: "140px",
                          height: "140px",
                        }}
                      ></div>
                    </div>

                    <div
                      className="absolute bg-gray-400 rounded-lg"
                      style={{
                        left: "620px",
                        top: "0px",
                        width: "650px",
                        height: "770px",
                      }}
                    >
                      <div
                        className="absolute bg-gray-600 rounded-full"
                        style={{
                          left: "230px",
                          top: "300px",
                          width: "140px",
                          height: "140px",
                        }}
                      ></div>
                    </div>

                    {leftSection.topRow.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        x={seat.x}
                        y={seat.y}
                      />
                    ))}

                    {leftSection.pillarSeats.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {leftSection.outerRing1.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {leftSection.outerRing2.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {leftSection.outerRing3.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {rightSection.straightSeats.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        x={seat.x}
                        y={seat.y}
                      />
                    ))}

                    {rightSection.pillarSeats.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}

                    {rightSection.outerRing1.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}

                    {rightSection.outerRing2.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}

                    {rightSection.outerRing3.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="sm:hidden bg-gray-100 rounded-xl p-2 overflow-auto">
                <div
                  className="relative"
                  style={{
                    width: "calc(100vw - 2rem)",
                    maxWidth: "1200px",
                    height: "600px",
                    overflow: "auto",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: "700px",
                      height: "800px",
                      transform: "scale(0.6)",
                      transformOrigin: "top left",
                      left: "100px",
                    }}
                  >
                    <div
                      className="absolute top-0 h-12 bg-gray-700 rounded-t-2xl flex items-center"
                      style={{
                        left: "-125px",
                        width: "1395px",
                      }}
                    >
                      <div className="text-base lg:text-xl font-bold text-white z-10 pl-4">
                        Entrance
                      </div>
                    </div>

                    <div
                      className="absolute top-12 w-33 bg-gray-700"
                      style={{
                        left: "486px",
                        bottom: "0px",
                      }}
                    ></div>

                    <div
                      className="absolute bg-gray-400 rounded-lg"
                      style={{
                        left: "-125px",
                        top: "50px",
                        width: "610px",
                        height: "720px",
                      }}
                    >
                      <div
                        className="absolute bg-gray-600 rounded-full"
                        style={{
                          left: "235px",
                          top: "250px",
                          width: "140px",
                          height: "140px",
                        }}
                      ></div>
                    </div>

                    <div
                      className="absolute bg-gray-400 rounded-lg"
                      style={{
                        left: "620px",
                        top: "50px",
                        width: "650px",
                        height: "720px",
                      }}
                    >
                      <div
                        className="absolute bg-gray-600 rounded-full"
                        style={{
                          left: "230px",
                          top: "250px",
                          width: "140px",
                          height: "140px",
                        }}
                      ></div>
                    </div>

                    {leftSection.topRow.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        x={seat.x}
                        y={seat.y}
                      />
                    ))}

                    {leftSection.pillarSeats.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {leftSection.outerRing1.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {leftSection.outerRing2.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {leftSection.outerRing3.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={180}
                        centerY={377}
                      />
                    ))}

                    {rightSection.straightSeats.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        x={seat.x}
                        y={seat.y}
                      />
                    ))}

                    {rightSection.pillarSeats.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}

                    {rightSection.outerRing1.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}

                    {rightSection.outerRing2.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}

                    {rightSection.outerRing3.map((seat) => (
                      <Seat
                        key={seat.number}
                        number={seat.number}
                        angle={seat.angle}
                        radius={seat.radius}
                        centerX={920}
                        centerY={377}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Booked Seats Table */}
            <div className="mt-4 sm:mt-6 bg-white rounded-lg shadow-lg p-3 sm:p-4 lg:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                  Seats Booked for {formatDisplayDate(selectedDate)}
                </h3>
                <span className="text-sm text-gray-500 mt-1 sm:mt-0">
                  {totalUnavailableCount} of {TOTAL_SEATS} seats unavailable
                  (includes locked)
                </span>
              </div>
              {Object.keys(dailyBookings).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-700">
                          Seat Number
                        </th>
                        <th className="px-4 py-3 font-semibold text-gray-700">
                          Booking Date
                        </th>
                        <th className="px-4 py-3 font-semibold text-gray-700 text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dailyBookings)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([seatNum]) => (
                          <tr
                            key={seatNum}
                            className="border-b hover:bg-gray-50 transition-colors"
                          >
                            {/* Seat Number */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Armchair size={16} className="text-cyan-600" />
                                <span className="font-bold text-gray-800">
                                  {seatNum}
                                </span>
                              </div>
                            </td>

                            {/* Booking Date */}
                            <td className="px-4 py-3 text-gray-600">
                              {formatDisplayDate(selectedDate)}
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleCancelBooking(seatNum)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-xs font-medium"
                                title="Cancel booking"
                              >
                                <Trash2 size={14} />
                                Cancel
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    No seats booked for {formatDisplayDate(selectedDate)}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Select seats above to make bookings
                  </p>
                </div>
              )}
            </div>
          </div>

          {showModal && <BookingModal />}
        </main>
      </div>
    </div>
  );
};

export default InternSeatManagement;
