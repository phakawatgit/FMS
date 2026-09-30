export const notFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

export const redirect = jest.fn((destination: string) => {
  throw new Error(`NEXT_REDIRECT:${destination}`);
});

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

export const useRouter = jest.fn(() => router);
