import {
    createBullBoard,
  } from "@bull-board/api";
  
  import {
    BullMQAdapter,
  } from "@bull-board/api/bullMQAdapter";
  
  import {
    ExpressAdapter,
  } from "@bull-board/express";
  
  import {
    weeklyReportQueue,
  } from "../weekly-reports/weekly-report.queue.js";
  
  const serverAdapter =
    new ExpressAdapter();
  
  serverAdapter.setBasePath(
    "/api/admin/queues"
  );
  
  createBullBoard({
    queues: [
      new BullMQAdapter(
        weeklyReportQueue
      ),
    ],
  
    serverAdapter,
  });
  
  export {
    serverAdapter as queueDashboardAdapter,
  };