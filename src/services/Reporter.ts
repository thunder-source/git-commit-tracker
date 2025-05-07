/**
 * Reporter Service
 * Handles formatting and outputting contribution reports
 */

import fs from "fs";
import path from "path";
import type { Contribution, Commit } from "../types";

/**
 * Configuration for the Reporter service
 */
export interface ReporterConfig {
  /** Format to use for console output */
  outputFormat: "simple" | "detailed";
  /** Directory to write report files to */
  outputDir: string;
  /** Skip writing to files */
  noFiles?: boolean;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Service for generating and outputting contribution reports
 */
export class Reporter {
  private format: "simple" | "detailed";
  private outputDir: string;
  private noFiles: boolean;
  private debug: boolean;

  /**
   * Creates a new Reporter instance
   * @param config Configuration options
   */
  constructor(config: ReporterConfig) {
    this.format = config.outputFormat;
    this.outputDir = config.outputDir || "reports";
    this.noFiles = config.noFiles ?? false;
    this.debug = config.debug ?? false;
  }

  /**
   * Prints contributions to the console
   * @param contributions Array of contributions
   * @param dateStr Date string for the report
   */
  public print(contributions: Contribution[], dateStr: string): void {
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

  /**
   * Writes contributions to a file
   * @param contributions Array of contributions
   * @param dateStr Date string for the report
   * @param format Output file format
   */
  public writeToFile(
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

  /**
   * Sorts and deduplicates commits
   * @param commits Array of commits
   * @returns Sorted and deduplicated array of commits
   */
  private sortAndDedup(commits: Commit[]): Commit[] {
    const sorted = [...commits].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return Array.from(new Map(sorted.map((c) => [c.hash, c])).values());
  }

  /**
   * Generates a minimal EOD report
   * @param contributions Array of contributions
   * @returns Minimal EOD report as a string
   */
  public generateMinimalEODReport(contributions: Contribution[]): string {
    const lines: string[] = [];
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    lines.push(`📝 EOD Summary - ${dateStr}\n`);

    for (const repo of contributions) {
      lines.push(`📁 Repository: ${repo.repo}`);

      const commits = this.sortAndDedup(repo.commits);

      for (const commit of commits) {
        const firstLine = commit.message.split("\n")[0];
        lines.push(`• ${firstLine} (${commit.author})`);
      }

      lines.push(""); // extra line between repos
    }

    return lines.join("\n");
  }

  /**
   * Writes a minimal EOD report to a file
   * @param message Report content
   */
  public writeMinimalEODReportFile(message: string): void {
    if (this.noFiles) return;

    const outDir = path.resolve(this.outputDir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const filePath = path.join(this.outputDir, `eod-summary-${dateStr}.txt`);
    
    fs.writeFileSync(filePath, message, "utf-8");
    
    // Also write to a generic file for easy access
    const genericPath = path.join(this.outputDir, `eod-summary.txt`);
    fs.writeFileSync(genericPath, message, "utf-8");
    
    if (this.debug) {
      console.debug(`[DEBUG] EOD summary written to ${filePath}`);
    }
  }
}
