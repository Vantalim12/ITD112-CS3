# Visualizing Filipino Emigration Trends (1981-2020) Using Firebase and React

**[Author Name]**
*Deparment of Computer Studies*
*Mindanao State University - Iligan Institute of Technology*
*Tibanga, Iligan City, Philippines*
*email@g.msuiit.edu.ph*

**Abstract**
This paper presents the development of a web-based data visualization application designed to analyze Filipino emigration trends from 1981 to 2020. The project utilizes a modern technology stack comprising React for the frontend and Firebase for the backend to create an interactive dashboard. The dataset, sourced from the Commission on Filipinos Overseas (CFO), encompasses various dimensions including age, civil status, occupation, and origin provinces. Key visualizations implemented include interactive choropleth maps for geographic distribution, candlestick charts for age group trends, and density plots for destination analysis. The application provides dynamic filtering and real-time data retrieval, offering researchers and policymakers a powerful tool to identify migration patterns, such as the increasing feminization of migration and the shift in popular destination countries over the decades.

**Key Words**: Filipino Emigration; Data Visualization; React; Firebase; Interactive Dashboard

## 1. INTRODUCTION

The Philippines is one of the top countries of origin for migrants globally, with a significant portion of its population seeking employment and permanent residence abroad. Understanding the complex patterns of this migration is crucial for policy formulation and social support systems. However, traditional tabular data presentation often fails to convey the multidimensional nature of these trends effectively.

This project aims to develop a web application that visualizes Filipino emigrants' data using interactive charts and graphs. The primary objective is to transform static CSV datasets into dynamic visual insights that allow users to explore relationships between variables such as year, age, sex, and destination country.

The significance of this study lies in its potential to democratize access to migration data. By leveraging web technologies, the system makes complex demographic data accessible to a broader audience, including sociologists, government agencies, and the general public, facilitating a deeper understanding of the Filipino diaspora.

## 2. METHODOLOGY

### 2.1 System Architecture
The application follows a serverless architecture pattern. **Firebase** serves as the backend platform, utilizing **Firestore** as the NoSQL document database to store structured emigrant data. The frontend is built with **React** (utilizing Vite for build tooling), which interfaces with Firebase via the Firebase Web SDK.

The application state and routing are managed using **TanStack Router**, ensuring a seamless single-page application (SPA) experience. Styling is implemented using **Tailwind CSS** for a responsive and modern user interface.

### 2.2 Data Preparation
The dataset was obtained from the Commission on Filipinos Overseas (CFO) covering the period from 1981 to 2020. The raw data, originally in CSV format, required significant preprocessing.
*   **Data Cleaning**: Inconsistencies in country names and province spellings were normalized (e.g., standardizing "USA" vs. "United States").
*   **Data Structure**: The data was categorized into collections: `Age`, `CivilStatus`, `Countries`, `Education`, `Occupation`, and `PlaceOfOrigin`.
*   **Ingestion**: A custom data population script was developed to parse the CSV files and batch-write documents to Firestore, ensuring data integrity and proper indexing for efficient queries.

### 2.3 Visualization Tools & Techniques
The project integrates multiple visualization libraries to suit different data types:
*   **Recharts**: Used for complex statistical charts. Specifically, a custom **Candlestick Chart** was implemented in the Trends module (`trends.tsx`) to visualize age group volatility and trends over time.
*   **Nivo**: Utilized for high-performance geometric visualizations. The **Choropleth Maps** (`choroplethMap.tsx`, `originChoropleth.tsx`) render geospatial data for world destinations and Philippine provinces.
*   **Density Plots**: Implemented using Nivo's `ResponsiveLine` to show the density distribution of emigrants across top destination countries over the 40-year period.

## 3. RESULTS AND DISCUSSION

The developed application successfully visualizes four decades of migration data. Key findings from the visualization modules include:

### 3.1 Geographic Distribution
Figure 1 illustrates the global distribution of Filipino emigrants. The **Geographic Visualization** module reveals a high concentration of emigrants moving to North America, specifically the United States and Canada. The interactive Choropleth map allows users to toggle between "Destination Countries" and "Origin Provinces." The Origin map (Figure 2) highlights that while Metro Manila remains a top source region, there is significant migration from provinces like Cebu, Cavite, and Pangasinan, indicating widespread mobility beyond the capital.

### 3.2 Age Group Trends
The **Trend Analysis** module, utilizing a Candlestick chart (Figure 3), provides a novel view of age demographics. Unlike simple line charts, the candlestick representation captures the volatility and range of emigrant counts within specific age brackets for each year. This visualization highlights a consistent demand for the "Working Age" group (20-40 years old), with observable spikes in specific years that correlate with global economic shifts.

### 3.3 Destination Density
Figure 4 displays the **Distribution Density Plots**, which effectively illustrate the shifting popularity of destination countries. While the USA has maintained a dominant position, the density curves show the rising prominence of other destinations such as Canada and Australia in the post-2000 era. The smooth curve interpolation helps in identifying long-term growth patterns versus short-term spikes.

## 4. CONCLUSION AND RECOMMENDATIONS

The integration of Firebase and React has proven to be an effective stack for developing data-intensive visualization applications. The use of Firestore allowed for flexible data modeling of the heterogeneous emigration datasets, while React's component-based architecture facilitated the creation of reusable chart components.

The visualization reveals that Filipino emigration is not static; it evolves with global economic demands and local demographic shifts. The tool successfully highlights these nuances, which are often lost in aggregate tables.

**Recommendations:**
1.  **Predictive Modeling**: Future iterations could integrate machine learning models to forecast future migration trends based on historical data.
2.  **Granular Filtering**: expanding the dataset to include gender-disaggregated data per province could provide deeper insights into the feminization of migration at the regional level.
3.  **Offline Support**: Implementing Progressive Web App (PWA) features to allow data access in low-connectivity environments.

## REFERENCES

[1] Commission on Filipinos Overseas, "Statistics on Filipino Emigrants," CFO, Manila, Philippines, 2020. [Online]. Available: https://cfo.gov.ph.

[2] Google Developers, "Firebase Documentation," Google, 2024. [Online]. Available: https://firebase.google.com/docs.

[3] Facebook Open Source, "React - A JavaScript library for building user interfaces," 2024. [Online]. Available: https://react.dev.

[4] Recharts Group, "Recharts: A Composable charting library built on React components," 2024. [Online]. Available: https://recharts.org.

[5] Nivo, "Nivo provides a rich set of data visualization components, built on top of the awesome d3 and React libraries," 2024. [Online]. Available: https://nivo.rocks.

