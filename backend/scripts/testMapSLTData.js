const SLTApiService = require('../services/sltApiService');

const sampleApi = [
  {
    "Trainee_ID": "2438",
    "Trainee_Name": "J.M. Nandun Deepaka Jayamanna",
    "Trainee_HomeAddress": "Jayamanna Walawwa, Pathakada, Pelmadulla",
    "Training_StartDate": "2024-11-20",
    "Training_EndDate": "2025-10-20",
    "Trainee_Email": "nandundeepaka@gmail.com",
    "Institute": "Informatics Institute of Technology",
    "field_of_spec_name": "Python"
  },
  {
    "Trainee_ID": "2442",
    "Trainee_Name": "R.M.M. Avishka Eranda Jayathilaka",
    "Trainee_HomeAddress": "416, Kandy road, Kadugannawa",
    "Training_StartDate": "2024-11-20",
    "Training_EndDate": "2025-10-20",
    "Trainee_Email": "jaysthilaka@gmail.com",
    "Institute": "IIT",
    "field_of_spec_name": "JAVA"
  }
];

const mapped = SLTApiService.mapToInternSchema(sampleApi);
console.log('Mapped result:');
console.log(JSON.stringify(mapped, null, 2));
