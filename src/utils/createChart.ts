import { Prisma } from "@prisma/client";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import { createCanvas } from "canvas";
import { offlineColor, onlineColor } from "./consts.js";

Chart.register(...registerables);

type PlayerCount = Prisma.PlayerCountGetPayload<{
  select: {
    createdAt: true;
    playerCount: true;
    maxPlayers: true;
  };
}>;

export const createPlayerCountChart = async (
  data: PlayerCount[],
  online: boolean,
  showMaxPlayers: [boolean, number] = [false, -1]
) => {
  // define chart dimensions
  const width = 640;
  const height = 400;

  // sort data by date from oldest to newest
  data.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const maxPlayerCount = showMaxPlayers[0]
    ? showMaxPlayers[1]
    : Math.max(...data.map((d) => d.playerCount));

  // create a canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // create the chart
  new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map((d) => d.createdAt.toISOString()),
      datasets: [
        {
          label: "Player Count",
          data: data.map((d) => d.playerCount),
          fill: false,
          borderColor: online ? onlineColor : offlineColor,
          tension: 0.1,
        },
      ],
    },
    options: {
      scales: {
        x: {
          type: "time",
          time: {
            unit: "minute", // Use minute as the unit since data is for the last 24 hours
            displayFormats: {
              minute: "HH:mm", // Display format for minutes
            },
          },
          ticks: {
            source: "auto",
            autoSkip: true,
            maxTicksLimit: 12,
          },
        },
        y: {
          beginAtZero: true,
          min: 0,
          max: maxPlayerCount + 5,
        },
      },
    },
  });

  return canvas.toBuffer("image/png");
};
