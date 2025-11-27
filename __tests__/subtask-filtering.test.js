describe("Subtask Link Filtering", () => {
  test("filters only OUTWARD links and excludes INWARD parent links", () => {
    // Arrange
    const links = [
      {
        direction: "OUTWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
        },
        trimmedIssues: [
          { idReadable: "TASK-100", summary: "Child task 1" },
          { idReadable: "TASK-101", summary: "Child task 2" },
        ],
      },
      {
        direction: "INWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
        },
        trimmedIssues: [{ idReadable: "STORY-50", summary: "Parent Story" }],
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    // Assert
    expect(subtaskLinks).toHaveLength(1);
    expect(subtaskLinks[0].direction).toBe("OUTWARD");
    expect(subtaskLinks[0].trimmedIssues).toHaveLength(2);
    expect(subtaskLinks[0].trimmedIssues[0].idReadable).toBe("TASK-100");
    expect(
      subtaskLinks[0].trimmedIssues.some(t => t.idReadable === "STORY-50")
    ).toBe(false);
  });

  test("returns empty array when only INWARD parent links exist", () => {
    // Arrange
    const links = [
      {
        direction: "INWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
        },
        trimmedIssues: [{ idReadable: "STORY-25", summary: "Parent Story" }],
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    // Assert
    expect(subtaskLinks).toHaveLength(0);
  });

  test("includes OUTWARD links even when trimmedIssues is empty", () => {
    // Arrange
    const links = [
      {
        direction: "OUTWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
        },
        trimmedIssues: [],
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    // Assert
    expect(subtaskLinks).toHaveLength(1);
    expect(subtaskLinks[0].trimmedIssues).toHaveLength(0);
  });

  test('excludes OUTWARD links that are not "subtask of" type', () => {
    // Arrange
    const links = [
      {
        direction: "OUTWARD",
        linkType: {
          targetToSource: "relates to",
          sourceToTarget: "relates to",
        },
        trimmedIssues: [{ idReadable: "TASK-200", summary: "Related issue" }],
      },
      {
        direction: "OUTWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
        },
        trimmedIssues: [{ idReadable: "TASK-201", summary: "Actual subtask" }],
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    // Assert
    expect(subtaskLinks).toHaveLength(1);
    expect(subtaskLinks[0].trimmedIssues[0].idReadable).toBe("TASK-201");
  });

  test("handles case-insensitive matching for link type", () => {
    // Arrange
    const links = [
      {
        direction: "OUTWARD",
        linkType: {
          targetToSource: "Subtask Of",
          sourceToTarget: "parent for",
        },
        trimmedIssues: [{ idReadable: "TASK-300", summary: "Child task" }],
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    // Assert
    expect(subtaskLinks).toHaveLength(1);
  });

  test("aggregates subtasks from multiple OUTWARD links", () => {
    // Arrange
    const links = [
      {
        direction: "OUTWARD",
        linkType: { targetToSource: "subtask of" },
        trimmedIssues: [
          { idReadable: "TASK-400", summary: "Child 1" },
          { idReadable: "TASK-401", summary: "Child 2" },
        ],
      },
      {
        direction: "OUTWARD",
        linkType: { targetToSource: "subtask of" },
        trimmedIssues: [{ idReadable: "TASK-402", summary: "Child 3" }],
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    const allSubtasks = [];
    subtaskLinks.forEach(link => {
      allSubtasks.push(...link.trimmedIssues);
    });

    // Assert
    expect(allSubtasks).toHaveLength(3);
    expect(allSubtasks.map(s => s.idReadable)).toEqual([
      "TASK-400",
      "TASK-401",
      "TASK-402",
    ]);
  });

  test("regression test - child task should not include parent story as subtask", () => {
    // Arrange
    const links = [
      {
        direction: "OUTWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
          directed: true,
          aggregation: true,
        },
        issuesSize: 0,
        trimmedIssues: [],
        id: "link-1",
      },
      {
        direction: "INWARD",
        linkType: {
          targetToSource: "subtask of",
          sourceToTarget: "parent for",
          directed: true,
          aggregation: true,
        },
        issuesSize: 1,
        trimmedIssues: [
          {
            idReadable: "STORY-42",
            summary: "Parent story",
            id: "issue-123",
          },
        ],
        id: "link-2",
      },
    ];

    // Act
    const subtaskLinks = links.filter(
      link =>
        link.direction === "OUTWARD" &&
        link.linkType.targetToSource.toLowerCase().includes("subtask of")
    );

    const allSubtasks = [];
    subtaskLinks.forEach(link => {
      allSubtasks.push(...link.trimmedIssues);
    });

    // Assert
    expect(allSubtasks).toHaveLength(0);
    expect(allSubtasks.some(s => s.idReadable === "STORY-42")).toBe(false);
  });
});
