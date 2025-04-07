import { Prisma } from "@prisma/client";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import { createCanvas } from "canvas";
import { offlineColor, onlineColor, peakColor } from "./consts.js";

Chart.register(...registerables);

type PlayerCount = Prisma.PlayerCountGetPayload<{
  select: {
    online: true;
    createdAt: true;
    playerCount: true;
    maxPlayers: true;
  };
}>;

export const createPlayerCountChart = async (
  data: PlayerCount[],
  showMaxPlayers: [boolean, number] = [false, -1]
) => {
  // define chart dimensions
  const width = 640;
  const height = 400;

  // sort data by date from oldest to newest
  data.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const peakPlayerCount = data
    .map((playerCount) => playerCount.playerCount)
    .reduce((a, b) => Math.max(a, b), 0);

  const maxPlayerCount = showMaxPlayers[0]
    ? showMaxPlayers[1]
    : Math.max(...data.map((d) => d.playerCount));

  // create a canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  // create the chart
  new Chart(ctx, {
    type: "scatter",
    plugins: [
      {
        // modified from https://stackoverflow.com/a/60240828
        id: "custom_multicolor_line_chart",
        beforeDraw: (chart) => {
          const ctx = chart.ctx;
          const xAxis = chart.scales["x"];
          const yAxis = chart.scales["y"];
          chart.config.data.datasets[0].data.forEach((_, index) => {
            const valueTo = data[index];
            const xTo = xAxis.getPixelForValue(valueTo.createdAt.getTime());
            const yTo = yAxis.getPixelForValue(valueTo.playerCount);
            if (index > 0) {
              const valueFrom = data[index - 1];
              const xFrom = xAxis.getPixelForValue(
                valueFrom.createdAt.getTime()
              );
              const yFrom = yAxis.getPixelForValue(valueFrom.playerCount);
              // draw line
              ctx.save();
              ctx.strokeStyle = valueTo.online
                ? valueTo.playerCount !== 0 &&
                  valueFrom.playerCount === valueTo.playerCount &&
                  valueTo.playerCount === peakPlayerCount
                  ? peakColor
                  : onlineColor
                : offlineColor;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(xFrom, yFrom);
              ctx.lineTo(xTo, yTo);
              ctx.stroke();
              ctx.restore();
            }
            // draw circle
            ctx.save();
            ctx.fillStyle =
              (valueTo.online
                ? valueTo.playerCount !== 0 &&
                  valueTo.playerCount === peakPlayerCount
                  ? peakColor
                  : onlineColor
                : offlineColor) + "80";
            ctx.strokeStyle = valueTo.online
              ? valueTo.playerCount !== 0 &&
                valueTo.playerCount === peakPlayerCount
                ? peakColor
                : onlineColor
              : offlineColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(xTo, yTo, 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          });
        },
      },
    ],
    data: {
      labels: data.map((d) => d.createdAt.toISOString()),
      datasets: [
        {
          label: "Player Count",
          data: data.map((d) => d.playerCount),
          fill: false,
          tension: 0.1,
          // remove points, we draw them manually in the plugin above
          borderColor: "transparent",
          borderWidth: 0,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: false, // remove legend
        },
      },
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
          max: Math.max(maxPlayerCount, 5), // min value to avoid too small graphs; hardcoded to 5
        },
      },
    },
  });

  return canvas.toBuffer("image/png");
};
