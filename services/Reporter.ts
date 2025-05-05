import fs from "fs";
import path from "path";
import type { Contribution, Commit } from "../types";

export interface ReporterConfig {
  outputFormat: "simple" | "detailed";
  outputDir: string;
  noFiles?: boolean;
  debug?: boolean;
}

export class Reporter {
  private format: "simple" | "detailed";
  private outputDir: string;
  private noFiles: boolean;
  private debug: boolean;

  constructor(config: ReporterConfig) {
    this.format = config.outputFormat;
    this.outputDir = config.outputDir || "reports";
    this.noFiles = config.noFiles ?? false;
    this.debug = config.debug ?? false;
  }

  print(contributions: Contribution[], dateStr: string): void {
    console.log(`\nContributions for ${dateStr}:\n`);

    for (const contribution of contributions) {
      console.log(`\n${contribution.repo}:`);
      const commits = this.sortAndDedup(contribution.commits);

      for (const commit of commits) {
        if (this.format === "detailed") {
          const dt = new Date(commit.timestamp);
          const fullDate = dt.toLocaleString("en-US", {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });

          console.log(
            `- ${commit.hash}\n  Author: ${commit.author}\n  Date: ${fullDate}\n  Message:\n  ${commit.message}\n`
          );
        } else {
          console.log(
            `- ${commit.hash}: ${commit.message.split("\n")[0]} (${
              commit.author
            })`
          );
        }
      }
    }
  }

  writeToFile(
    contributions: Contribution[],
    dateStr: string,
    format: "txt" | "json" | "md" = "txt"
  ): void {
    if (this.noFiles) return;

    const outDir = path.resolve(this.outputDir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const filePath = path.join(outDir, `contributions-${dateStr}.${format}`);

    if (format === "json") {
      fs.writeFileSync(
        filePath,
        JSON.stringify(contributions, null, 2),
        "utf-8"
      );
    } else if (format === "md") {
      const lines: string[] = [`# Contributions for ${dateStr}`];
      for (const c of contributions) {
        lines.push(`\n## ${c.repo}`);
        for (const commit of this.sortAndDedup(c.commits)) {
          lines.push(
            `- \`${commit.hash}\` - **${commit.author}** on ${new Date(
              commit.timestamp
            ).toLocaleString()}\n  > ${commit.message}`
          );
        }
      }
      fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    } else {
      const lines: string[] = [`Contributions for ${dateStr}:\n`];
      for (const c of contributions) {
        lines.push(`\n${c.repo}:`);
        for (const commit of this.sortAndDedup(c.commits)) {
          if (this.format === "detailed") {
            const fullDate = new Date(commit.timestamp).toLocaleString(
              "en-US",
              {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              }
            );
            lines.push(
              `- ${commit.hash}\n  Author: ${commit.author}\n  Date: ${fullDate}\n  Message:\n  ${commit.message}\n`
            );
          } else {
            lines.push(
              `- ${commit.hash}: ${commit.message.split("\n")[0]} (${
                commit.author
              })`
            );
          }
        }
      }
      fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
    }

    console.log(`\n✅ Report written to ${filePath}`);
  }

  private sortAndDedup(commits: Commit[]): Commit[] {
    const sorted = [...commits].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return Array.from(new Map(sorted.map((c) => [c.hash, c])).values());
  }
}
