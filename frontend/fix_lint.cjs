const fs = require('fs');
let c = fs.readFileSync('src/pages/AdminSeatManagement.jsx', 'utf-8');
c = c.replace('import React, { useState, useEffect, useRef } from "react";', 'import React, { useState, useEffect } from "react";');
c = c.replace('import { leftSection, rightSection, useMapScale, getLocalISODate } from "./useSeatManagement";', 'import { leftSection, rightSection, getLocalISODate } from "./useSeatManagement";');
c = c.replace('const isToday = selectedDate === todayStr;', '');
c = c.replace('const tomorrowStr = getLocalISODate(tomorrowDate);', '');
fs.writeFileSync('src/pages/AdminSeatManagement.jsx', c);
