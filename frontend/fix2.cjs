const fs = require('fs');
let c = fs.readFileSync('src/pages/AdminSeatManagement.jsx', 'utf-8');
c = c.replace('import { Armchair } from "lucide-react";\n  const MAP_WIDTH = 1450;', 
`import { Armchair } from "lucide-react";
import { API_BASE_URL } from "../api/apiConfig";

import {
  adminSeatApi,
  seatBookingCsvUtils,
  seatNotificationUtils,
} from "../api/adminSeatApi";
import { leftSection, rightSection, getLocalISODate } from "./useSeatManagement";

const TOTAL_SEATS = 88;

const AdminSeatManagement = () => {
  const navigate = useNavigate();
  const [mapElement, setMapElement] = useState(null);
  const MAP_WIDTH = 1450;`);
fs.writeFileSync('src/pages/AdminSeatManagement.jsx', c);
