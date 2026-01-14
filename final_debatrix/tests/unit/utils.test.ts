import { describe, it, expect } from "vitest";

describe("Search and Filter Logic", () => {
  const mockDebates = [
    { id: "1", topic: "AI Ethics", status: "active", personaA: "Prof Smith", personaB: "Dr Jones" },
    { id: "2", topic: "Climate Policy", status: "completed", personaA: "Eco Expert", personaB: "Skeptic" },
    { id: "3", topic: "AI in Healthcare", status: "paused", personaA: "Dr Tech", personaB: "Dr Care" },
  ];

  describe("Search Functionality", () => {
    it("should filter by topic keyword", () => {
      const search = "AI";
      const filtered = mockDebates.filter(d => 
        d.topic.toLowerCase().includes(search.toLowerCase())
      );
      
      expect(filtered).toHaveLength(2);
      expect(filtered[0].topic).toContain("AI");
    });

    it("should filter by persona name", () => {
      const search = "Smith";
      const filtered = mockDebates.filter(d => 
        d.personaA.toLowerCase().includes(search.toLowerCase()) ||
        d.personaB.toLowerCase().includes(search.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
    });

    it("should be case insensitive", () => {
      const search = "climate";
      const filtered = mockDebates.filter(d => 
        d.topic.toLowerCase().includes(search.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].topic).toBe("Climate Policy");
    });

    it("should return empty for no matches", () => {
      const search = "nonexistent";
      const filtered = mockDebates.filter(d => 
        d.topic.toLowerCase().includes(search.toLowerCase())
      );
      
      expect(filtered).toHaveLength(0);
    });
  });

  describe("Status Filter", () => {
    it("should filter active debates", () => {
      const filtered = mockDebates.filter(d => d.status === "active");
      expect(filtered).toHaveLength(1);
    });

    it("should filter completed debates", () => {
      const filtered = mockDebates.filter(d => d.status === "completed");
      expect(filtered).toHaveLength(1);
    });

    it("should filter paused debates", () => {
      const filtered = mockDebates.filter(d => d.status === "paused");
      expect(filtered).toHaveLength(1);
    });

    it("should return all when filter is 'all'", () => {
      const status = "all";
      const filtered = status === "all" ? mockDebates : mockDebates.filter(d => d.status === status);
      expect(filtered).toHaveLength(3);
    });
  });

  describe("Sort Logic", () => {
    const debatesWithDates = [
      { id: "1", createdAt: new Date("2024-01-01"), argumentCount: 5 },
      { id: "2", createdAt: new Date("2024-01-03"), argumentCount: 10 },
      { id: "3", createdAt: new Date("2024-01-02"), argumentCount: 3 },
    ];

    it("should sort by newest first", () => {
      const sorted = [...debatesWithDates].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      expect(sorted[0].id).toBe("2");
    });

    it("should sort by oldest first", () => {
      const sorted = [...debatesWithDates].sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      );
      
      expect(sorted[0].id).toBe("1");
    });

    it("should sort by most arguments", () => {
      const sorted = [...debatesWithDates].sort((a, b) => 
        b.argumentCount - a.argumentCount
      );
      
      expect(sorted[0].id).toBe("2");
      expect(sorted[0].argumentCount).toBe(10);
    });
  });
});

describe("Fingerprint Deduplication", () => {
  it("should detect duplicate fingerprint", () => {
    const votes = [
      { argumentId: "arg-1", fingerprint: "fp-123" },
      { argumentId: "arg-2", fingerprint: "fp-456" },
    ];
    
    const newVote = { argumentId: "arg-1", fingerprint: "fp-123" };
    const isDuplicate = votes.some(v => 
      v.argumentId === newVote.argumentId && v.fingerprint === newVote.fingerprint
    );
    
    expect(isDuplicate).toBe(true);
  });

  it("should allow same fingerprint on different arguments", () => {
    const votes = [
      { argumentId: "arg-1", fingerprint: "fp-123" },
    ];
    
    const newVote = { argumentId: "arg-2", fingerprint: "fp-123" };
    const isDuplicate = votes.some(v => 
      v.argumentId === newVote.argumentId && v.fingerprint === newVote.fingerprint
    );
    
    expect(isDuplicate).toBe(false);
  });
});

describe("URL Query Parameter Building", () => {
  it("should build empty query for defaults", () => {
    const params = new URLSearchParams();
    const search = "";
    const status = "all";
    const sortBy = "newest";
    
    if (search) params.set("search", search);
    if (status !== "all") params.set("status", status);
    if (sortBy !== "newest") params.set("sortBy", sortBy);
    
    expect(params.toString()).toBe("");
  });

  it("should include search parameter", () => {
    const params = new URLSearchParams();
    params.set("search", "AI Ethics");
    
    expect(params.toString()).toContain("search=");
  });

  it("should include multiple parameters", () => {
    const params = new URLSearchParams();
    params.set("search", "AI");
    params.set("status", "active");
    params.set("sortBy", "arguments");
    
    const queryString = params.toString();
    expect(queryString).toContain("search=AI");
    expect(queryString).toContain("status=active");
    expect(queryString).toContain("sortBy=arguments");
  });

  it("should encode special characters", () => {
    const params = new URLSearchParams();
    params.set("search", "AI & Machine Learning");
    
    expect(params.toString()).toContain("%26");
  });
});

describe("Persona Stats Calculation", () => {
  it("should calculate total debates from participation", () => {
    const personaId = "persona-1";
    const debates = [
      { personaAId: "persona-1", personaBId: "persona-2" },
      { personaAId: "persona-3", personaBId: "persona-1" },
      { personaAId: "persona-2", personaBId: "persona-3" },
    ];
    
    const totalDebates = debates.filter(d => 
      d.personaAId === personaId || d.personaBId === personaId
    ).length;
    
    expect(totalDebates).toBe(2);
  });

  it("should count wins correctly", () => {
    const personaId = "persona-1";
    const debates = [
      { winnerId: "persona-1" },
      { winnerId: "persona-2" },
      { winnerId: "persona-1" },
      { winnerId: null },
    ];
    
    const wins = debates.filter(d => d.winnerId === personaId).length;
    
    expect(wins).toBe(2);
  });

  it("should count arguments by persona", () => {
    const personaId = "persona-1";
    const args = [
      { personaId: "persona-1", content: "arg1" },
      { personaId: "persona-2", content: "arg2" },
      { personaId: "persona-1", content: "arg3" },
    ];
    
    const totalArgs = args.filter(a => a.personaId === personaId).length;
    
    expect(totalArgs).toBe(2);
  });

  it("should sum votes received", () => {
    const personaArgs = ["arg-1", "arg-3"];
    const votes = [
      { argumentId: "arg-1" },
      { argumentId: "arg-2" },
      { argumentId: "arg-1" },
      { argumentId: "arg-3" },
    ];
    
    const totalVotes = votes.filter(v => personaArgs.includes(v.argumentId)).length;
    
    expect(totalVotes).toBe(3);
  });
});

describe("Round Management", () => {
  it("should increment round correctly", () => {
    let currentRound = 1;
    const totalRounds = 3;
    
    currentRound++;
    
    expect(currentRound).toBe(2);
    expect(currentRound <= totalRounds).toBe(true);
  });

  it("should detect final round", () => {
    const currentRound = 3;
    const totalRounds = 3;
    
    expect(currentRound >= totalRounds).toBe(true);
  });

  it("should track turn order", () => {
    const argumentsInRound = [
      { personaId: "A", roundNumber: 1 },
      { personaId: "B", roundNumber: 1 },
    ];
    
    const isRoundComplete = argumentsInRound.length === 2;
    expect(isRoundComplete).toBe(true);
  });
});
